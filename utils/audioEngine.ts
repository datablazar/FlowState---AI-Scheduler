
// A lightweight Web Audio API engine to generate focus noise without external files

export type NoiseType = 'brown' | 'pink' | 'white';

class AudioEngine {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;

  private init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
    }
  }

  private createNoiseBuffer(type: NoiseType): AudioBuffer {
    if (!this.context) throw new Error("Audio context not initialized");
    
    const bufferSize = 2 * this.context.sampleRate; // 2 seconds buffer
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      
      if (type === 'white') {
        output[i] = white;
      } else if (type === 'pink') {
        // Approximate pink noise (1/f)
        const b0 = 0.99886 * (this.lastOut + white * 0.0555179);
        this.lastOut = b0;
        output[i] = b0 * 3.5; // Gain compensation
      } else if (type === 'brown') {
        // Approximate brown noise (1/f^2)
        const b0 = (this.lastOut + (0.02 * white)) / 1.02;
        this.lastOut = b0;
        output[i] = b0 * 3.5; 
      }
    }
    return buffer;
  }
  
  // State for noise generation filters
  private lastOut = 0;

  public play(type: NoiseType, volume: number = 0.5) {
    this.init();
    if (this.isPlaying) this.stop();

    if (this.context?.state === 'suspended') {
      this.context.resume();
    }

    const buffer = this.createNoiseBuffer(type);
    this.noiseNode = this.context!.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;
    this.noiseNode.connect(this.gainNode!);
    
    this.gainNode!.gain.value = volume;
    this.noiseNode.start();
    this.isPlaying = true;
  }

  public stop() {
    if (this.noiseNode) {
      this.noiseNode.stop();
      this.noiseNode.disconnect();
      this.noiseNode = null;
    }
    this.isPlaying = false;
  }

  public setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.setTargetAtTime(volume, this.context!.currentTime, 0.1);
    }
  }
}

export const focusAudio = new AudioEngine();
