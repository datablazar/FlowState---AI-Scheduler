
import { GoogleGenAI, Type } from "@google/genai";
import { Task, Priority, TaskStatus } from "../types";
import { addMinutes } from "date-fns";
import { roundToNearest15 } from "../utils/helpers";
import { getMemoryContext } from "./memoryService";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ==========================================
// AI SECTION: Parsing & Generation Only
// ==========================================

export const parseTaskInput = async (input: string): Promise<Partial<Task>> => {
  if (!apiKey) return { title: input, durationMinutes: 30, priority: Priority.MEDIUM };

  try {
    const memoryContext = getMemoryContext(input);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${memoryContext ? `${memoryContext}\n\n` : ''}Extract task details from: "${input}". 
      Return JSON. 
      Rules:
      - Default duration: 30m.
      - Default priority: Medium.
      - If specific time mentioned (e.g. "at 5pm"), set 'scheduledStart' (ISO) and 'isFixed': true.
      - If 'after [Task]', extract dependency name context.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
            priority: { type: Type.STRING, enum: [Priority.HIGH, Priority.MEDIUM, Priority.LOW] },
            deadline: { type: Type.STRING, description: "ISO date or null" },
            description: { type: Type.STRING },
            isFixed: { type: Type.BOOLEAN },
            scheduledStart: { type: Type.STRING },
          },
          required: ["title", "durationMinutes", "priority"],
        },
      },
    });

    const data = JSON.parse(response.text || '{}');
    const duration = roundToNearest15(data.durationMinutes || 30);
    
    // Calculate scheduledEnd if fixed
    let scheduledEnd;
    if (data.isFixed && data.scheduledStart) {
        scheduledEnd = addMinutes(new Date(data.scheduledStart), duration).toISOString();
    }

    return {
      title: data.title,
      durationMinutes: duration,
      priority: data.priority as Priority,
      deadline: data.deadline,
      description: data.description,
      status: TaskStatus.TODO,
      isFixed: data.isFixed,
      scheduledStart: data.scheduledStart,
      scheduledEnd: scheduledEnd
    };
  } catch (error) {
    console.error("Gemini parse error:", error);
    return { title: input, durationMinutes: 30, priority: Priority.MEDIUM, status: TaskStatus.TODO };
  }
};

export const parseBulkTasks = async (input: string): Promise<Partial<Task>[]> => {
  if (!apiKey) {
      // Fallback for no API key: split by newline
      return input.split('\n').filter(line => line.trim()).map(line => ({
          title: line.trim(),
          durationMinutes: 30,
          priority: Priority.MEDIUM,
          status: TaskStatus.TODO
      }));
  }

  try {
    const memoryContext = getMemoryContext(input);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${memoryContext ? `${memoryContext}\n\n` : ''}Parse this "Brain Dump" into a list of tasks. 
      Input: """${input}"""
      
      Return a JSON Array of tasks.
      Rules:
      - Infer duration and priority if possible. Default 30m, Medium.
      - Keep titles concise.
      - If a line seems like a note for the previous task, add it to description.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              durationMinutes: { type: Type.NUMBER },
              priority: { type: Type.STRING, enum: [Priority.HIGH, Priority.MEDIUM, Priority.LOW] },
            },
            required: ["title", "durationMinutes", "priority"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((t: any) => ({
        ...t,
        durationMinutes: roundToNearest15(t.durationMinutes || 30),
        status: TaskStatus.TODO
    }));
  } catch (error) {
    console.error("Gemini bulk parse error:", error);
    return [];
  }
};

/**
 * Step 1: Use Search Grounding to get context (e.g. Syllabus, Meeting details if public)
 */
export const researchTopic = async (query: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key missing");

  try {
    // Use Flash with Grounding for speed and accuracy
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Research the following request to find syllabus details, timelines, or key requirements: "${query}". 
      Summarize the findings into a structured curriculum or meeting agenda format that is easy to break down into tasks.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // We return the text (markdown) to be fed into the next model
    return response.text || "No information found.";
  } catch (error) {
    console.error("Gemini search error:", error);
    throw error;
  }
};

/**
 * Step 2: Use Thinking Model to break down content into tasks
 */
export const generateTasksFromContent = async (
  content: string | { mimeType: string; data: string },
  contextNote: string,
  projectVelocity: number = 1.0
): Promise<Task[]> => {
  if (!apiKey) throw new Error("API Key missing");

  const memoryContext = getMemoryContext(contextNote);
  let contentPart: any;
  if (typeof content === 'string') {
    contentPart = { text: content };
  } else {
    contentPart = { inlineData: content };
  }

  const prompt = `
    Role: Senior Project Manager & Curriculum Designer.
    Goal: Break down the provided content into actionable, granular Tasks and Subtasks.
    
    Context from User: "${contextNote}"
    ${memoryContext ? `\n${memoryContext}` : ''}
    Project Velocity Multiplier: ${projectVelocity} (If >1, user works faster, so reduce duration. If <1, increase duration).

    Process:
    1. Analyze the content deeply. If it's a meeting minute, identify action items. If it's a course, identify modules/lessons.
    2. Estimate realistic duration for each task. Apply the velocity multiplier: (BaseDuration / Velocity).
    3. Ensure no task is longer than 90 minutes. If longer, split it.
    4. Assign priorities based on urgency or sequence.
    5. Return a flat array of Tasks. Use the 'subtasks' field for very small steps within a task.
    
    Output JSON Format:
    [
      {
        "title": "Task Title",
        "description": "Detailed description of what to do.",
        "durationMinutes": 30,
        "priority": "High" | "Medium" | "Low",
        "subtasks": [{"title": "Step 1"}, {"title": "Step 2"}]
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          contentPart,
          { text: prompt }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for complex breakdown
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              durationMinutes: { type: Type.NUMBER },
              priority: { type: Type.STRING, enum: [Priority.HIGH, Priority.MEDIUM, Priority.LOW] },
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING }
                  },
                  required: ["title"]
                }
              }
            },
            required: ["title", "durationMinutes", "priority"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    
    return parsed.map((item: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      title: item.title,
      description: item.description,
      durationMinutes: roundToNearest15(item.durationMinutes || 30),
      priority: item.priority as Priority,
      status: TaskStatus.TODO,
      subtasks: item.subtasks?.map((s: any, sIdx: number) => ({
          id: `sub-${Date.now()}-${index}-${sIdx}`,
          title: s.title,
          isCompleted: false
      })) || []
    }));

  } catch (error) {
    console.error("Gemini thinking generation error:", error);
    throw error;
  }
};

export const generateStudyPlan = async (
  content: string | { mimeType: string; data: string },
  project: string,
  deadline: string | undefined,
  history: Task[],
  velocity: number = 1.0,
  chunkInfo?: { current: number; total: number }
): Promise<Task[]> => {
    // Wrapper to maintain backward compatibility if needed, 
    // but we prefer generateTasksFromContent for the new Capture flow.
    return generateTasksFromContent(content, `Project: ${project}. Deadline: ${deadline || 'None'}.`, velocity);
};
