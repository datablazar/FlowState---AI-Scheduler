
import { GoogleGenAI, Type } from "@google/genai";
import { Task, Priority, TaskStatus } from "../types";
import { addMinutes, endOfDay, addDays } from "date-fns";
import { roundToNearest15 } from "../utils/helpers";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ==========================================
// AI SECTION: Parsing & Generation Only
// ==========================================

export const parseTaskInput = async (input: string): Promise<Partial<Task>> => {
  if (!apiKey) return { title: input, durationMinutes: 30, priority: Priority.MEDIUM };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract task details from: "${input}". 
      Return JSON. 
      Rules:
      - Default duration: 30m.
      - Default priority: Medium.
      - If specific time mentioned (e.g. "at 5pm"), set 'scheduledStart' (ISO) and 'isFixed': true.
      - If 'after [Task]', extract dependency name context.
      - Identify 2-6 crisp subtasks if the task is multi-step. Keep them short.
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
    });

    const data = JSON.parse(response.text || '{}');
    const duration = roundToNearest15(data.durationMinutes || 30);
    
    // Calculate scheduledEnd if fixed
    let scheduledEnd;
    if (data.isFixed && data.scheduledStart) {
        scheduledEnd = addMinutes(new Date(data.scheduledStart), duration).toISOString();
    }

    const subtasks = Array.isArray(data.subtasks)
      ? data.subtasks.map((s: any, idx: number) => ({
          id: `sub-${Date.now()}-${idx}`,
          title: s.title || `Step ${idx + 1}`,
          isCompleted: false
        }))
      : undefined;

    return {
      title: data.title,
      durationMinutes: duration,
      priority: data.priority as Priority,
      deadline: data.deadline,
      description: data.description,
      status: TaskStatus.TODO,
      isFixed: data.isFixed,
      scheduledStart: data.scheduledStart,
      scheduledEnd: scheduledEnd,
      subtasks
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this "Brain Dump" into a list of tasks. 
      Input: """${input}"""
      
      Return a JSON Array of tasks.
      Rules:
      - Infer duration, priority, and optional subtasks if possible. Default 30m, Medium.
      - Keep titles concise.
      - If a line seems like a note for the previous task, add it to description.
      - Add 2-6 short subtasks for multi-step items when helpful.
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
              subtasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING } },
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
    return parsed.map((t: any, idx: number) => ({
        ...t,
        durationMinutes: roundToNearest15(t.durationMinutes || 30),
        status: TaskStatus.TODO,
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks.map((s: any, sIdx: number) => ({
              id: `sub-${Date.now()}-${idx}-${sIdx}`,
              title: s.title || `Step ${sIdx + 1}`,
              isCompleted: false
            }))
          : undefined
    }));
  } catch (error) {
    console.error("Gemini bulk parse error:", error);
    return [];
  }
};

export interface TodoEstimate {
  title: string;
  durationMinutes: number;
  priority: Priority;
  deadline?: string;
}

const heuristicPriority = (title: string, fallback: Priority): Priority => {
  const normalized = title.toLowerCase();
  if (/(urgent|asap|!|today|before|due)/.test(normalized)) return Priority.HIGH;
  if (/(maybe|later|someday|idea)/.test(normalized)) return Priority.LOW;
  if (/(follow up|reply|email|ping)/.test(normalized)) return Priority.MEDIUM;
  return fallback;
};

const heuristicDuration = (title: string, fallback: number): number => {
  const normalized = title.toLowerCase();
  if (/(call|email|reply|check in)/.test(normalized)) return 15;
  if (/(draft|write|outline|plan)/.test(normalized)) return 60;
  if (/(research|investigate|debug|deep dive)/.test(normalized)) return 90;
  if (/(review|refine|edit)/.test(normalized)) return 45;
  return fallback;
};

const heuristicDeadline = (priority: Priority): string | undefined => {
  const today = new Date();
  if (priority === Priority.HIGH) return endOfDay(addDays(today, 1)).toISOString();
  if (priority === Priority.MEDIUM) return endOfDay(addDays(today, 3)).toISOString();
  return endOfDay(addDays(today, 5)).toISOString();
};

export const estimateTodoList = async (
  items: string[],
  defaults: { durationMinutes: number; priority: Priority }
): Promise<TodoEstimate[]> => {
  const base = items
    .map(line => line.trim())
    .filter(Boolean)
    .map(title => {
      const priority = heuristicPriority(title, defaults.priority);
      return {
        title,
        durationMinutes: roundToNearest15(heuristicDuration(title, defaults.durationMinutes)),
        priority,
        deadline: heuristicDeadline(priority)
      };
    });

  if (!apiKey) return base;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Given this to-do list, assign an intelligent duration (minutes, realistic and aligned to 15-minute blocks) and priority (High/Medium/Low). 
      If a line already implies urgency, respect it. Keep titles as-is.
      Default duration: ${defaults.durationMinutes} minutes. Default priority: ${defaults.priority}.
      Suggest a realistic deadline (ISO date) if obvious; otherwise keep it null. High priority should usually be within 1-2 days, Medium 3-5 days, Low 5-7 days.
      Lines: ${items.join(" | ")}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              durationMinutes: { type: Type.NUMBER },
              priority: { type: Type.STRING, enum: [Priority.HIGH, Priority.MEDIUM, Priority.LOW] },
              deadline: { type: Type.STRING, description: "ISO date or null" },
            },
            required: ["title", "durationMinutes", "priority"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) return base;

    return parsed.map((item: any, idx: number) => ({
      title: item.title || base[idx]?.title || `Task ${idx + 1}`,
      durationMinutes: roundToNearest15(item.durationMinutes || defaults.durationMinutes),
      priority: (item.priority as Priority) || defaults.priority,
      deadline: item.deadline || base[idx]?.deadline
    }));
  } catch (error) {
    console.error("Gemini todo estimate error:", error);
    return base;
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
