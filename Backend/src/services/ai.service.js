const { GoogleGenAI } = require("@google/genai");
const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema')
const puppeteer = require('puppeteer');

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

/*
*this is not a mongodb schema, it is a zod schema(it return a expected structure output of data.)
*/
const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile match the job description"),

    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach should take etc"),
    })).describe("Technical question can be asked in the interview and how to answer them"),

    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach should take etc"),
    })).describe('Behavioral question that can be asked in the interview along with their intention and how to answer them'),

    skillGap: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(['low', 'medium', 'high']).describe("The severity of skill gap, i.e.")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),

    preparationPlans: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structure, system design, mock interviews"),
        tasks: z.array(z.string()).describe("List of tasks to be on this day to follow the preparation plan,e.g. read a specific book")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for interview effective."),

    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const prompt = `You are a senior technical interviewer. Generate HIGH-QUALITY, non-repetitive interview questions based on the candidate's resume and the job description.

CRITICAL RULES:
1. EACH question MUST have THREE required fields: "question", "intention", AND "answer"
2. Do NOT return strings - ALWAYS return objects with all three fields
3. Do NOT return incomplete data
4. NEVER skip the intention or answer fields
5. Return ONLY valid JSON with the exact structure shown below
6. Every array item MUST be a complete object with all required fields

TECHNICAL QUESTIONS - MUST INCLUDE 5 questions with different types:
1. One conceptual question
2. One practical coding/design question
3. One debugging/problem-solving question
4. One real-world scenario-based question
5. One advanced/optimization question

BEHAVIORAL QUESTIONS - MUST INCLUDE 3-5 unique scenario-based questions focusing on:
- Different skills (teamwork, problem-solving, learning, pressure handling)
- Recent experience from the resume
- Relevance to the job description

IMPORTANT OUTPUT RULES:
- Do NOT repeat patterns like "Explain...", "What is..." in every question
- Each question must test a DIFFERENT concept
- Ensure variety in question types
- Avoid generic textbook questions


                    TECHNICAL QUESTIONS MUST INCLUDE:
                    1. One conceptual question
                    2. One practical coding/design question
                    3. One debugging/problem-solving question
                    4. One real-world scenario-based question
                    5. One advanced/optimization question

                    BEHAVIORAL QUESTIONS MUST:
                    - Be unique and scenario-based
                    - Not repeat same intent
                    - Focus on different skills (teamwork, problem-solving, learning, pressure)

                    EXAMPLE OUTPUT FORMAT (Follow this exactly):

                    {
                      "title": "Job Title",
                      "matchScore": 85,
                      "technicalQuestions": [
                        {
                          "question": "Describe how you would design a caching layer for a high-traffic API",
                          "intention": "System design ability and optimization thinking",
                          "answer": "A good answer would cover: cache invalidation strategies, TTL settings, cache key design, memory considerations, distributed caching options like Redis, trade-offs between cache hit rates and memory usage."
                        },
                        {
                          "question": "What is the difference between SQL and NoSQL databases?",
                          "intention": "Concept understanding and technology selection",
                          "answer": "SQL databases use ACID properties and structured schemas, perfect for consistent data. NoSQL is flexible, scales horizontally, better for unstructured data. The choice depends on use case requirements."
                        }
                      ],
                      "behavioralQuestions": [
                        {
                          "question": "Tell me about a time when you had to work with a difficult team member",
                          "intention": "Teamwork and communication skills",
                          "answer": "Structure answer with STAR method: Situation, Task, Action, Result. Focus on how you managed conflict professionally and reached a positive outcome."
                        }
                      ],
                      "skillGap": [
                        {
                          "skill": "System Design",
                          "severity": "high"
                        }
                      ],
                      "preparationPlans": [
                        {
                          "day": 1,
                          "focus": "System Design Fundamentals",
                          "tasks": ["Read about scalability", "Study caching strategies", "Review database design patterns"]
                        }
                      ]
                    }

                    SPECIAL INSTRUCTIONS:
                    - Questions MUST be based on candidate's resume and job description
                    - Each question should feel like asked by a real interviewer
                    - Avoid generic phrasing
                    - Make questions slightly challenging
                    - Each answer MUST be unique to its question
                    - DO NOT repeat answers
                    - Answer should be specific, not generic    

                    Each intention must belong to a DIFFERENT category:
                - Concept understanding
                - Debugging ability
                - System design
                - Real-world application
                - Performance optimization

                    Resume:
                    ${resume}

                    Self Description:
                    ${selfDescription}

                    Job Description:
                    ${jobDescription}
                    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            {
                role: "user",
                parts: [{
                    text: prompt
                }]
            }
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: zodToJsonSchema(interviewReportSchema)
        }
    })

    let result;

    try {
        result = JSON.parse(response.text);
    } catch (err) {
        console.error("Invalid JSON from AI:", response.text);
        throw new Error("AI did not return valid JSON");
    }

    // 🔧 DEBUG - Log what AI actually returned
    console.log("📋 RAW AI Response:");
    console.log("   Full technicalQuestions array:", JSON.stringify(result.technicalQuestions?.slice(0, 2), null, 2));
    console.log("   Full behavioralQuestions array:", JSON.stringify(result.behavioralQuestions?.slice(0, 2), null, 2));
    console.log("   Total technical:", result.technicalQuestions?.length);
    console.log("   Total behavioral:", result.behavioralQuestions?.length);

    // 🔧 FIX START - Enhanced data cleaning and restructuring

/**
 * Groups flat strings into proper question objects
 * Handles cases where AI returns ["question", "text1", "intention", "text2", "answer", "text3"]
 */
const groupFlatQuestionsIntoObjects = (arr) => {
    if (!Array.isArray(arr)) return [];
    
    const result = [];
    let currentQuestion = {};

    arr.forEach((item) => {
        if (typeof item === "string") {
            // Skip placeholder strings like "question", "intention", "answer"
            if (["question", "intention", "answer", "Question", "Intention", "Answer"].includes(item.trim())) {
                return;
            }
            // For other strings, use as question if empty
            if (!currentQuestion.question) {
                currentQuestion.question = item;
            } else if (!currentQuestion.intention) {
                currentQuestion.intention = item;
            } else if (!currentQuestion.answer) {
                currentQuestion.answer = item;
                result.push(currentQuestion);
                currentQuestion = {};
            }
        } else if (typeof item === "object" && item !== null) {
            // If we have proper objects, use them
            if (item.question || item.intention || item.answer) {
                if (Object.keys(currentQuestion).length > 0) {
                    result.push(currentQuestion);
                }
                result.push(item);
                currentQuestion = {};
            }
        }
    });

    // Add last item if pending
    if (Object.keys(currentQuestion).length > 0) {
        result.push(currentQuestion);
    }

    return result;
};

/**
 * Validates and fixes question arrays to ensure each item has question, intention, and answer
 * IMPORTANT: Only adds structure if missing, does NOT modify existing valid data
 */
const ensureQuestionStructure = (arr, type) => {
    if (!Array.isArray(arr)) return [];

    // First, try to group flat items into objects
    let items = groupFlatQuestionsIntoObjects(arr);
    
    // If grouping didn't help, use original array
    if (items.length === 0) {
        items = arr;
    }

    return items.map((item, index) => {
        // If item is already a proper object with all fields, return as is
        if (typeof item === "object" && item !== null && 
            item.question && item.intention && item.answer) {
            return item;
        }

        // If item is an object but missing fields, fill them in
        if (typeof item === "object" && item !== null) {
            return {
                question: item.question || `Question ${index + 1}`,
                intention: item.intention || "Evaluation",
                answer: item.answer || "Answer not available"
            };
        }

        // Skip placeholder strings
        if (typeof item === "string" && 
            ["question", "intention", "answer", "Question", "Intention", "Answer"].includes(item.trim())) {
            return null;
        }

        // If item is a JSON string representation of a question object, parse it
        if (typeof item === "string") {
            try {
                const parsed = JSON.parse(item);
                if (parsed && typeof parsed === 'object' && (parsed.question || parsed.intention || parsed.answer)) {
                    return {
                        question: parsed.question || `Question ${index + 1}`,
                        intention: parsed.intention || "Evaluation",
                        answer: parsed.answer || "Answer not available"
                    };
                }
            } catch (parseError) {
                // not JSON string, continue with fallback
            }

            return {
                question: item,
                intention: "Evaluation",
                answer: "Answer not available"
            };
        }

        // Fallback for any other type
        return {
            question: `Question ${index + 1}`,
            intention: "Evaluation",
            answer: "Answer not available"
        };
    }).filter(item => item !== null); // Remove nulls from placeholder strings
};

const ensureSkillGapStructure = (arr) => {
    if (!Array.isArray(arr)) return [];

    return arr.map((item) => {
        // If already a good object, return as is
        if (typeof item === "object" && item !== null && 
            item.skill && ['low', 'medium', 'high'].includes(item.severity)) {
            return item;
        }

        // If object but missing fields, fill them
        if (typeof item === "object" && item !== null) {
            return {
                skill: item.skill || "Skill Gap",
                severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : "medium"
            };
        }

        // Skip placeholder strings
        if (typeof item === "string" && ["skill", "severity", "Skill", "Severity"].includes(item.trim())) {
            return null;
        }

        // If string, convert to object
        if (typeof item === "string" && item.trim().length > 0) {
            return {
                skill: item,
                severity: "medium"
            };
        }

        return null; // Skip invalid items
    }).filter(item => item !== null);
};

const ensurePreparationPlanStructure = (arr) => {
    if (!Array.isArray(arr)) return [];

    return arr.map((item, index) => {
        // If already a good object, return as is
        if (typeof item === "object" && item !== null && 
            typeof item.day === "number" && item.focus && Array.isArray(item.tasks)) {
            return item;
        }

        // If object but missing fields, fill them
        if (typeof item === "object" && item !== null) {
            return {
                day: typeof item.day === "number" ? item.day : index + 1,
                focus: item.focus || "Preparation",
                tasks: Array.isArray(item.tasks) ? item.tasks : ["Study and practice"]
            };
        }

        // Skip placeholder strings
        if (typeof item === "string" && ["day", "focus", "tasks", "Day", "Focus", "Tasks"].includes(item.trim())) {
            return null;
        }

        // If string, convert to object
        if (typeof item === "string" && item.trim().length > 0) {
            return {
                day: index + 1,
                focus: item,
                tasks: ["Study and practice"]
            };
        }

        return null; // Skip invalid items
    }).filter(item => item !== null);
};
result.technicalQuestions = ensureQuestionStructure(result.technicalQuestions, "technical");
result.behavioralQuestions = ensureQuestionStructure(result.behavioralQuestions, "behavioral");
result.skillGap = ensureSkillGapStructure(result.skillGap);
result.preparationPlans = ensurePreparationPlanStructure(result.preparationPlans);

// 🔧 DEBUG - Log cleaned data
console.log("🧹 After Cleaning:");
console.log("   Technical questions after filter:", result.technicalQuestions.length);
console.log("   Sample cleaned technical:", JSON.stringify(result.technicalQuestions?.[0], null, 2));
console.log("   Behavioral questions after filter:", result.behavioralQuestions.length);
console.log("   Sample cleaned behavioral:", JSON.stringify(result.behavioralQuestions?.[0], null, 2));

// 🔧 FIX END

   

    //ZOD validation
    const validated = interviewReportSchema.safeParse(result);

    if (!validated.success) {
        console.error("Zod Validation Error:", validated.error.errors);
        throw new Error("AI response structure invalid");
    }

    result = validated.data;

    console.log("✅ Interview Report Generated Successfully");
    console.log(`   - Technical Questions: ${result.technicalQuestions.length}`);
    console.log(`   - Behavioral Questions: ${result.behavioralQuestions.length}`);
    console.log(`   - Skill Gaps: ${result.skillGap.length}`);
    console.log(`   - Preparation Days: ${result.preparationPlans.length}`);
    console.log(`   - Match Score: ${result.matchScore}%`);

    // Trim to reasonable sizes (keep only meaningful questions)
    // Keep max 10 each safely but ensure minimum 6
    if (result.technicalQuestions.length > 10) {
        console.warn(`⚠️ Trimming ${result.technicalQuestions.length} technical questions to 10`);
        result.technicalQuestions = result.technicalQuestions.slice(0, 10);
    }
    if (result.behavioralQuestions.length > 10) {
        console.warn(`⚠️ Trimming ${result.behavioralQuestions.length} behavioral questions to 10`);
        result.behavioralQuestions = result.behavioralQuestions.slice(0, 10);
    }

    // Enforce minimum 6 questions each
    if (result.technicalQuestions.length < 6) {
        const needed = 6 - result.technicalQuestions.length;
        for (let i = 0; i < needed; i++) {
            result.technicalQuestions.push({
                question: `Technical question ${result.technicalQuestions.length + 1} not generated`,
                intention: "Evaluation",
                answer: "Answer not available"
            });
        }
    }
    if (result.behavioralQuestions.length < 6) {
        const needed = 6 - result.behavioralQuestions.length;
        for (let i = 0; i < needed; i++) {
            result.behavioralQuestions.push({
                question: `Behavioral question ${result.behavioralQuestions.length + 1} not generated`,
                intention: "Evaluation",
                answer: "Answer not available"
            });
        }
    }

    // ✅ RETURN CLEAN DATA
    // Data is already validated by Zod schema, so we trust it
    return result;
}

async function generatedPdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({ format: "A4" })

    await browser.close();
    return pdfBuffer
}


async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")

    })

    const prompt = `Generate a resume  for a candidate with the following details:
        Self Description: ${selfDescription}
        Job Description: ${jobDescription}
        Resume: ${resume}
        
        the response should be in JSON format with single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.`

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: zodToJsonSchema(resumePdfSchema)
        }
    })
    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatedPdfFromHtml(jsonContent.html)
    return pdfBuffer
}

module.exports = { generateInterviewReport, generateResumePdf };