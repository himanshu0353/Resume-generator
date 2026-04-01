import { getAllInterviewReports, generateInterviewReport, getInterviewReportById , generateResumePdf} from "../services/interview.api";
import { useCallback, useContext } from 'react';
import { InterviewContext } from "../interview.context";

export const useInterview = () => {

    const context = useContext(InterviewContext)

    if(!context){
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const {loading, setLoading, report, setReport, reports, setReports} = context

    const generateReport = useCallback(async ({resume, selfDescription, jobDescription}) => {
        setLoading(true)
        let response = null
        try{
            response = await generateInterviewReport({resume, selfDescription, jobDescription })
            setReport(response.interviewReport)
        }catch(err){
            console.log(err)
        }finally{
            setLoading(false)
        }
        return response?.interviewReport
    }, [setLoading, setReport])

    const getReportById = useCallback(async (interviewId) => {
        setLoading(true)
        let response = null
        try{
            response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
        }catch(err){
            console.log(err)
        }finally{
            setLoading(false)
        }
        return response?.interviewReport
    }, [setLoading, setReport])

    const getReports = useCallback(async () => {
        setLoading(true)
        let response = null
        try{
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        }catch(err){
            console.log(err)
        }finally{
            setLoading(false)
        }
        return response?.interviewReports
    }, [setLoading, setReports])

    const getResumePdf = useCallback(async (interviewReportId) => {
        setLoading(true)
        let response = null
        try{
            response = await generateResumePdf({ interviewReportId})
            const url = window.URL.createObjectURL(new Blob([response], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `resume_${interviewReportId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }catch(err){
            console.log(err)
        }finally{
            setLoading(false)
        }
    }, [setLoading])

    return { loading, report, reports, generateReport, getReportById, getReports, getResumePdf }


}
