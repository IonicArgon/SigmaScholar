import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { CohereClientV2 } from 'cohere-ai'
import { firestore } from '../lib/firebase'

// Define secrets
const cohereApiKey = defineSecret('COHERE_API_KEY')

/**
 * Generate a quiz question using document context and YouTube context
 */
async function generateQuizQuestion(userId: string, subject: string, youtubeContext: string): Promise<any> {
  try {
    console.log(`[generateQuizQuestion] Generating quiz for user: ${userId}, subject: ${subject}`)
    
    // Retrieve cleaned text from Firestore for the subject and user
    const filesQuery = await firestore.collection('files')
      .where('userId', '==', userId)
      .where('subjectName', '==', subject)
      .where('processingStatus', '==', 'completed')
      .where('cleanedText', '!=', '')
      .get()
    
    if (filesQuery.empty) {
      throw new Error(`No processed documents found for user ${userId} in subject: ${subject}`)
    }
    
    // Combine all cleaned text from documents in this subject
    const documentContext = filesQuery.docs
      .map(doc => doc.data().cleanedText)
      .filter(text => text && text.length > 0)
      .join('\n\n')
    
    console.log(`[generateQuizQuestion] Found ${filesQuery.docs.length} documents, combined text length: ${documentContext.length}`)
    
    if (documentContext.length === 0) {
      throw new Error(`No text content available for subject: ${subject}`)
    }
    
    // Initialize Cohere client
    const cohere = new CohereClientV2({
      token: cohereApiKey.value()
    })
    
    // System prompt for quiz generation
    const systemPrompt = `You are an expert quiz generator. Your task is to create funny but educational multiple-choice questions based on document content and YouTube video context.

The YouTube context will be provided as JSON containing:
- title: The video title
- description: Video description
- channelName: Channel that posted the video
- transcript: Partial transcript of the video content

Requirements:
1. Generate either true/false or 4-option multiple choice questions
2. Questions should be challenging but fair
3. Use both document context and YouTube JSON context to create relevant questions
4. Always return valid JSON format
5. Include explanations for all answers

JSON Response Format:
{
  "question": "The question text",
  "type": "multiple_choice" | "true_false",
  "options": ["Option A", "Option B", "Option C", "Option D"] | ["True", "False"],
  "correctAnswer": 0,
  "explanations": {
    "correct": "Why the correct answer is right",
    "incorrect": ["Why option 0 is wrong", "Why option 1 is wrong", ...]
  }
}`

    const userPrompt = `Generate a quiz question based on the following contexts:

DOCUMENT CONTEXT:
${documentContext.substring(0, 3000)}

YOUTUBE VIDEO CONTEXT (JSON):
${youtubeContext}

Create a challenging question that combines information from both contexts.`

    const response = await cohere.chat({
      model: 'command-a-03-2025',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        // Few-shot examples
        {
          role: 'user',
          content: `Generate a quiz question based on the following contexts:

DOCUMENT CONTEXT:
The quadratic formula is x = -b ± √(b² - 4ac) / 2a where a ≠ 0. This formula solves any quadratic equation ax² + bx + c = 0. The discriminant b² - 4ac determines the nature of the roots.

YOUTUBE VIDEO CONTEXT (JSON):
{
  "title": "Cat Videos Compilation #47 - Funny Cats Being Derps",
  "description": "Watch these hilarious cats being absolute chaos agents for 10 minutes straight",
  "channelName": "CatMemesCentral",
  "transcript": "Look at this orange cat just... existing. Why are cats like this? This one's trying to fit in a box that's clearly too small but refuses to give up..."
}`
        },
        {
          role: 'assistant',
          content: `{
  "question": "Just like that orange cat trying to squeeze into an impossibly small box, what happens when the discriminant b² - 4ac in the quadratic formula is negative?",
  "type": "multiple_choice",
  "options": [
    "The equation has no real solutions, only complex solutions (like the cat's logic)",
    "The equation has exactly one real solution",
    "The equation has two distinct real solutions",
    "The quadratic formula breaks down completely"
  ],
  "correctAnswer": 0,
  "explanations": {
    "correct": "When the discriminant is negative, just like that stubborn cat refusing to accept reality, the equation produces complex (imaginary) solutions instead of real ones. The math still works, it's just living in imagination land!",
    "incorrect": [
      "",
      "One real solution happens when the discriminant equals zero - that's when the cat actually fits perfectly in the box",
      "Two real solutions occur when the discriminant is positive - like having multiple boxes that actually fit the cat",
      "The quadratic formula never breaks down, it just gets creative with complex numbers when reality doesn't cooperate"
    ]
  }
}`
        },
        {
          role: 'user',
          content: `Generate a quiz question based on the following contexts:

DOCUMENT CONTEXT:
CH₃CH₂OH + O₂ → CH₃COOH + H₂O. The oxidation of ethanol produces acetic acid. This reaction is catalyzed by enzymes in living organisms. The process requires oxygen and produces water as a byproduct.

YOUTUBE VIDEO CONTEXT (JSON):
{
  "title": "Epic Fail Compilation - People Falling Down for 10 Minutes Straight",
  "description": "The funniest fails and tumbles caught on camera. You'll laugh until you cry!",
  "channelName": "FailArmy",
  "transcript": "Oh no! Watch this guy try to jump over a fence and... NOPE! And here's someone slipping on ice, classic! Why do people think they can parkour when they can barely walk?"
}`
        },
        {
          role: 'assistant',
          content: `{
  "question": "Unlike those epic parkour fails where people think they can defy physics, alcohol metabolism in your liver actually follows chemistry rules. What does ethanol (CH₃CH₂OH) need to successfully transform into acetic acid without face-planting?",
  "type": "multiple_choice",
  "options": [
    "Oxygen and specific enzymes (the proper landing technique)",
    "Only high temperature (like those hot concrete fails)",
    "Carbon dioxide and water (wrong chemistry, wrong landing)",
    "Only enzymes, no oxygen needed (missing a crucial step, like forgetting to bend your knees)"
  ],
  "correctAnswer": 0,
  "explanations": {
    "correct": "Just like those successful parkour videos need proper technique AND timing, ethanol oxidation needs both oxygen (O₂) and specific liver enzymes to stick the landing and produce acetic acid without failing spectacularly.",
    "incorrect": [
      "",
      "High temperature isn't needed - this isn't a concrete-melting fail compilation, it's a smooth enzymatic reaction at body temperature",
      "Carbon dioxide and water aren't the reactants here - that's like confusing a trampoline for solid ground",
      "Enzymes alone can't do it - you need oxygen too, just like you need both speed AND proper form to not end up in a fail compilation"
    ]
  }
}`
        },
        {
          role: 'user',
          content: `Generate a quiz question based on the following contexts:

DOCUMENT CONTEXT:
The Renaissance was a period of cultural rebirth in Europe from the 14th to 17th centuries. It marked the transition from the Middle Ages to modernity, characterized by advances in art, literature, and science.

YOUTUBE VIDEO CONTEXT (JSON):
{
  "title": "MrBeast Ranks Historical Art Movements from WORST to BEST",
  "description": "I spent $100,000 hiring art experts to rank every major art movement in history. You won't believe what came in last place!",
  "channelName": "MrBeast",
  "transcript": "Alright guys, today we're ranking art movements and I've got some serious art historians here. Renaissance is looking pretty good so far, but wait until you see what happens when we get to modern art..."
}`
        },
        {
          role: 'assistant',
          content: `{
  "question": "MrBeast just ranked the Renaissance pretty high on his list, but what made Renaissance artists like Leonardo da Vinci absolutely DOMINATE the art game compared to medieval artists?",
  "type": "multiple_choice",
  "options": [
    "They combined artistic skills with scientific observation (the ultimate content creator strategy)",
    "They just painted faster and uploaded more frequently",
    "They used more expensive materials (pay-to-win strategy)",
    "They only painted rich people for better sponsorship deals"
  ],
  "correctAnswer": 0,
  "explanations": {
    "correct": "Just like MrBeast combines entertainment with genuine value, Renaissance artists mixed artistic talent with scientific study - dissecting bodies, studying light physics, and mastering perspective. This combo made their content (art) way more realistic and engaging than medieval artists who stuck to flat, symbolic styles.",
    "incorrect": [
      "",
      "Speed and quantity don't automatically equal quality - even MrBeast spends months planning his videos for maximum impact",
      "Expensive materials alone don't make great art, just like expensive cameras don't automatically make great YouTube videos",
      "While patronage helped, the real game-changer was their innovative techniques and scientific approach to creating realistic art"
    ]
  }
}`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      maxTokens: 2000,
      temperature: 0.3
    })
    
    // Extract and parse the JSON response
    const messageContent = response.message?.content?.[0]
    const responseText = messageContent && 'text' in messageContent ? messageContent.text : ''
    
    console.log(`[generateQuizQuestion] Raw response: ${responseText}`)
    
    // Parse JSON response
    const quizQuestion = JSON.parse(responseText)
    
    console.log(`[generateQuizQuestion] Generated quiz question for subject: ${subject}`)
    return quizQuestion
    
  } catch (error) {
    console.error(`[generateQuizQuestion] Error generating quiz for subject ${subject}:`, error)
    throw error
  }
}

/**
 * HTTP callable function to generate quiz questions
 */
export const generateQuiz = onCall<{
  subject: string
  youtubeContext: string
}>({
  secrets: [cohereApiKey]
}, async (request) => {
  const { auth, data } = request
  
  if (!auth) {
    throw new Error('Authentication required')
  }
  
  const { subject, youtubeContext } = data
  
  if (!subject || !youtubeContext) {
    throw new Error('Subject and YouTube context are required')
  }
  
  console.log(`[generateQuiz] Generating quiz for subject: ${subject}`)
  
  try {
    const quizQuestion = await generateQuizQuestion(auth.token.uid, subject, youtubeContext)
    
    return {
      success: true,
      quiz: quizQuestion
    }
    
  } catch (error) {
    console.error(`[generateQuiz] Error:`, error)
    throw new Error(`Failed to generate quiz: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})
