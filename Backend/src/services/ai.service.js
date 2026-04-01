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

    const prompt = `
        
                
                    You are a senior technical interviewer.

                    Your goal is to generate HIGH-QUALITY and NON-REPETITIVE interview questions.

                    IMPORTANT RULES:
                    - DO NOT repeat patterns like "Explain...", "What is..." in every question
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

                    STRICT OUTPUT FORMAT:

                    {
                    "title": "Interview Report",
                    "matchScore": number,
                    "technicalQuestions": string[10],
                    "behavioralQuestions": string[10],
                    "skillGap": string[7],
                    "preparationPlans": string[10]
                    }

                    SPECIAL INSTRUCTIONS:
                    - Questions MUST be based on candidate's resume and job description
                    - Each question should feel like asked by a real interviewer
                    - Avoid generic phrasing
                    - Make questions slightly challenging

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

    //  Fallback defaults
    result.technicalQuestions = result.technicalQuestions?.length >= 5
        ? result.technicalQuestions
        : Array(5).fill({
            question: "Explain your backend experience",
            intention: "Evaluate backend skills",
            answer: "Discuss Node.js, APIs, scaling"
        });

    result.behavioralQuestions = result.behavioralQuestions?.length >= 3
        ? result.behavioralQuestions
        : Array(3).fill({
            question: "Tell me about a challenge",
            intention: "Check problem solving",
            answer: "Use STAR method"
        });

    result.skillGap = result.skillGap?.length >= 3
        ? result.skillGap
        : Array(3).fill({
            skill: "System Design",
            severity: "medium"
        });

    result.preparationPlans = result.preparationPlans?.length >= 7
        ? result.preparationPlans
        : Array(7).fill({
            day: 1,
            focus: "Basics",
            tasks: ["Revise fundamentals"]
        });
    result.matchScore = typeof result.matchScore === "number"
        ? result.matchScore
        : 70;



    const normalizeArray = (arr, type) => {
        if (!Array.isArray(arr)) return [];

        return arr.map((item, index) => {
            if (typeof item === "string") {
                if (type === "technical") {
                    return {
                        question: item,
                        intention: "Evaluate technical knowledge",
                        answer: "Explain with examples"
                    };
                }

                if (type === "behavioral") {
                    return {
                        question: item,
                        intention: "Evaluate behavior",
                        answer: "Use STAR method"
                    };
                }

                if (type === "skill") {
                    return {
                        skill: item,
                        severity: "medium"
                    };
                }

                if (type === "plan") {
                    return {
                        day: index + 1,
                        focus: item,
                        tasks: ["Study and practice"]
                    };
                }
            }

            return item;
        });
    };

    result.technicalQuestions = normalizeArray(result.technicalQuestions, "technical");
    result.behavioralQuestions = normalizeArray(result.behavioralQuestions, "behavioral");
    result.skillGap = normalizeArray(result.skillGap, "skill");
    result.preparationPlans = normalizeArray(result.preparationPlans, "plan");

    console.log('AI Response:', response.text);

    //  ZOD VALIDATION
    const validated = interviewReportSchema.safeParse(result);

    if (!validated.success) {
        console.error("Zod Error:", validated.error);
        throw new Error("AI response structure invalid");
    }

    // RETURN CLEAN DATA
    return validated.data;
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