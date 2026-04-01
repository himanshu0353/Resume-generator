import axios from 'axios';


const Api = axios.create({
    baseURL: 'http://localhost:3000',
    withCredentials: true
})

export const generateInterviewReport = async({resume, selfDescription, jobDescription}) =>{
    
    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('selfDescription', selfDescription);
    formData.append('jobDescription', jobDescription);

    const response =  await Api.post('/api/interview', formData,{
        headers:{
            "Content-Type": "multipart/form-data"
        }
    })

    return response.data
    
} 

export const getInterviewReportById = async(interviewId) => {
    const response = await Api.get(`/api/interview/report/${interviewId}`)

    return response.data
 }

export const getAllInterviewReports = async() => {
    const response = await Api.get('/api/interview/report') 
    return response.data
}

export const generateResumePdf = async({interviewReportId}) => {
    const response = await Api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: "blob"
    })
    return response.data
}