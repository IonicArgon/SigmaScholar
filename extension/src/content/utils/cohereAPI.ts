import { VideoData } from './videoExtractor'

export interface GeneratedQuestions {
  questions: string[]
  videoId: string
  generatedAt: number
}


export class CohereAPI {
  private static readonly API_ENDPOINT = 'https://api.cohere.ai/v1/generate'
  
  // Note: In production, this should be stored securely (environment variables)
  // For now, we'll make it configurable
  private static apiKey: string | null = null

  static setApiKey(key: string): void {
    this.apiKey = key
  }

  static async generateQuestions(videoData: VideoData): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('Cohere API key not set. Please configure your API key first.')
    }

    try {
      const prompt = this.buildPrompt(videoData)
      
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'command-light',
          prompt: prompt,
          max_tokens: 300,
          temperature: 0.7,
          k: 0,
          stop_sequences: [],
          return_likelihoods: 'NONE'
        })
      })

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const generatedText = data.generations[0]?.text || ''
      
      return this.parseQuestions(generatedText)
    } catch (error) {
      console.error('Error generating questions:', error)
      throw error
    }
  }


  private static buildPrompt(videoData: VideoData): string {
    const platformName = this.getPlatformDisplayName(videoData.platform)
    
    return `Based on this ${platformName} video content, generate 5 thoughtful study questions that would help someone learn from and remember the key concepts:

Title: "${videoData.title}"
Author: ${videoData.author || 'Unknown'}
Platform: ${platformName}
${videoData.description ? `Description: "${videoData.description}"` : ''}

Generate questions that are:
1. Educational and thought-provoking
2. Help with comprehension and retention
3. Encourage critical thinking
4. Suitable for academic study

Format your response as a numbered list:
1. [Question 1]
2. [Question 2]
3. [Question 3]
4. [Question 4]
5. [Question 5]

Questions:`
  }


  private static parseQuestions(generatedText: string): string[] {
    try {
      // Split by lines and filter out empty lines
      const lines = generatedText.split('\n').filter(line => line.trim())
      
      const questions: string[] = []
      
      for (const line of lines) {
        // Look for numbered questions (1., 2., etc.)
        const match = line.match(/^\d+\.\s*(.+)/)
        if (match && match[1]) {
          questions.push(match[1].trim())
        }
      }
      
      // If no numbered questions found, try to split by sentences
      if (questions.length === 0) {
        const sentences = generatedText.split(/[.!?]+/).filter(s => s.trim().length > 10)
        return sentences.slice(0, 5).map(s => s.trim() + '?')
      }
      
      return questions.slice(0, 5) // Limit to 5 questions
    } catch (error) {
      console.error('Error parsing questions:', error)
      return ['What are the main concepts discussed in this video?', 'What is the primary topic of this video?', 'What is the main idea of this video?', 'What are the key points of this video?', 'What can you learn from this video?']
    }
  }


  private static getPlatformDisplayName(platform: VideoData['platform']): string {
    switch (platform) {
      case 'youtube-shorts':
        return 'YouTube Shorts'
      case 'instagram-reels':
        return 'Instagram Reels'
      case 'tiktok':
        return 'TikTok'
      default:
        return 'video'
    }
  }

  // Test connection to Cohere API
  static async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false
    }

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'command-light',
          prompt: 'Test connection',
          max_tokens: 10,
          temperature: 0.1
        })
      })

      return response.ok
    } catch {
      return false
    }
  }
}
