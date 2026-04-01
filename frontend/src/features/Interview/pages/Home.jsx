import React, { useState, useRef } from 'react';
import "../style/home.scss";
import { useInterview } from '../hooks/useInterview.js';
import {useNavigate} from "react-router"

const Home = () => {
 
  const {loading, generateReport, reports} = useInterview()
  const [jobDescription, setJobDescription] = useState("")
  const [selfDescription, setSelfDescription] = useState("")
  const resumeInputRef = useRef()
  const navigate = useNavigate()
  const handleGenerateReport = async () => {
    const resume = resumeInputRef.current.files[0]
    const data = await generateReport({resume, jobDescription, selfDescription})
    navigate(`/interview/${data._id}`)
  }

  if(loading){
    return (
      <main className='loading-screen'>
        <h1> loading you interview plan....</h1>
      </main>
    )
  }

  return (
    <main className='home'>
      <section className='hero'>
        <h1 className="heading"><b>Create Your Custom Interview Plan</b></h1>
        <p>
          Empower your recruitment process with AI-driven insights. Input job
          requirements and candidate details to generate a comprehensive interview
          blueprint.
        </p>
      </section>

      <div className='interview-input-group'>
        <section className='card job-desc'>
          <div className='card-header'>
            <h2>Job Description</h2>
            <span className='tag'>Required</span>
          </div>
          <textarea
            onChange={(e) => {setJobDescription(e.target.value)}}
            name='jobDescription'
            id='jobDescription'
            placeholder='Paste the full job description here... include key responsibilities, required skills, and culture fit.'
          />
        </section>

        <section className='card right-panel'>
          <div className='card-block'>
            <label htmlFor='resume'>Resume</label>
            <input ref={resumeInputRef  } hidden type='file' name='resume' id='resume' accept='.pdf,.docx' />
            <label className='file-label' htmlFor='resume'>
              Upload Resume
            </label>
            <small>Drag and drop or click to browse</small>
          </div>

          <div className='card-block'>
            <label htmlFor='selfDescription'>Self Description</label>
            <textarea
              onChange={(e) => {setSelfDescription(e.target.value)}}
              name='selfDescription'
              id='selfDescription'
              placeholder='Optional: Add the candidate personal summary or intro note for deeper context...'
            />
          </div>

          <button 
              onClick={handleGenerateReport}
              className='button generate-btn'>Generate Interview Report</button>
          <p className='note'>AI will prioritize these insights during analysis.</p>
        </section>
      </div>

      {/* {reports.length > 0 && (
        <section className='recent-reports'>
          <h2>My Recent Reports</h2>
          <ul className='reports-list'>
            {reports.map(report =>(
              <li key={report._id} className='report-item' onclick={() => navigate(`/interview/${report._id}`)}>
                <h3>{report.title || 'Untitled Report'}</h3>
              </li>
            ))}
          </ul>
        </section>
      )} */}

    </main>
  );
};

export default Home;