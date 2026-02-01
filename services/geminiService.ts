import { GoogleGenAI, Type } from "@google/genai";
import { StudyLog, GeminiAnalysis } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeStudyHabits = async (logs: StudyLog[]): Promise<GeminiAnalysis> => {
  const ai = getAiClient();
  
  // Prepare a condensed version of the logs for the prompt to save tokens
  // We'll take the last 90 days for detailed analysis
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentLogs = sortedLogs.slice(0, 90).map(l => `${l.date}: ${l.hours}h`).join('\n');
  
  const prompt = `
    Analyze this study log data (Date: Hours) for the last 90 days.
    Provide a structured analysis of my study habits.
    
    Data:
    ${recentLogs}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "A encouraging summary of the study patterns (max 2 sentences)." },
          strengths: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "2 key strengths observed (e.g., consistency on weekends)." 
          },
          improvements: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "2 areas for improvement (e.g., skipping Mondays)." 
          },
          tip: { type: Type.STRING, description: "One actionable productivity tip based on the data." }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as GeminiAnalysis;
  }
  
  throw new Error("Failed to generate analysis");
};
