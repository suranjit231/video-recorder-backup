


import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { FaCamera, FaStop, FaPlay, FaTimes, FaSave, FaPause, 
         FaArrowUp, FaArrowDown, FaEdit } from 'react-icons/fa';
import styles from './Recorder.module.css';

const Recorder = () => {
  // Existing states
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [videoURL, setVideoURL] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordTime, setRecordTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const [countdown, setCountdown] = useState(null);

  // New states for teleprompter
  const [script, setScript] = useState('');
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // pixels per second
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const prompterRef = useRef(null);
  const scrollInterval = useRef(null);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
      if (scrollInterval.current) clearInterval(scrollInterval.current);
      if (videoURL) URL.revokeObjectURL(videoURL);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [timerInterval, videoURL]);

  const startScriptScrolling = React.useCallback(() => {
    if (scrollInterval.current) clearInterval(scrollInterval.current);
    
    scrollInterval.current = setInterval(() => {
      if (prompterRef.current) {
        prompterRef.current.scrollTop += scrollSpeed;
      }
    }, 50);
  }, [scrollSpeed]);

  const stopScriptScrolling = React.useCallback(() => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  // Start scrolling when recording starts
  useEffect(() => {
    if (isRecording && !isPaused && prompterRef.current) {
      startScriptScrolling();
    } else {
      stopScriptScrolling();
    }
  }, [isRecording, isPaused, startScriptScrolling, stopScriptScrolling]);

  const adjustScrollSpeed = (change) => {
    setScrollSpeed(prev => Math.max(0.5, Math.min(10, prev + change)));
  };

  const handleScriptChange = (e) => {
    setScript(e.target.value);
  };

  const toggleScriptEdit = () => {
    setIsEditingScript(!isEditingScript);
  };

  // Existing countdown effect
  useEffect(() => {
    let countdownInterval;
    if (countdown !== null && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      startActualRecording();
    }
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [countdown]);

  // Modified closeCamera to include new cleanup
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerInterval);
    stopScriptScrolling();
    setRecordTime(0);
    setVideoURL(null);
    setRecordedChunks([]);
    setError(null);
    setCountdown(null);
  };

  const openCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      streamRef.current = stream;
      setIsCameraOpen(true);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Failed to access camera: ' + err.message);
    }
  };

  const startRecording = () => {
    if (!webcamRef.current || !webcamRef.current.stream) {
      setError('No active stream found');
      return;
    }
    setCountdown(3); // Start countdown from 3
  };

  const startActualRecording = () => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setRecordedChunks([]);
      setCountdown(null);
      
      let options;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options = { mimeType: 'video/webm;codecs=vp9' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      } else {
        options = {};
      }

      const mediaRecorder = new MediaRecorder(webcamRef.current.stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
          setRecordedChunks(prevChunks => [...prevChunks, e.data]);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (videoURL) {
          URL.revokeObjectURL(videoURL);
        }
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
      };

      mediaRecorder.start(200);
      
      const interval = setInterval(() => {
        setRecordTime(prevTime => prevTime + 1);
      }, 1000);
      setTimerInterval(interval);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording: ' + err.message);
      setIsRecording(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        clearInterval(timerInterval);
        setIsPaused(true);
        mediaRecorderRef.current.requestData();
      } catch (err) {
        console.error('Pause error:', err);
        setError('Failed to pause recording: ' + err.message);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
        const interval = setInterval(() => {
          setRecordTime(prevTime => prevTime + 1);
        }, 1000);
        setTimerInterval(interval);
        setIsPaused(false);
      } catch (err) {
        console.error('Resume error:', err);
        setError('Failed to resume recording: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setIsPaused(false);
        clearInterval(timerInterval);
      } catch (err) {
        console.error('Stop error:', err);
        setError('Failed to stop recording: ' + err.message);
      }
    }
  };

  const saveVideo = () => {
    if (recordedChunks.length) {
      try {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `recorded-video-${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Save error:', err);
        setError('Failed to save video: ' + err.message);
      }
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={styles.recorderContainer}>
      <h1 className={styles.title}>Video Recorder</h1>
      
      {error && <div className={styles.error}>{error}</div>}
      
      {!isCameraOpen ? (
        <div className={styles.setupSection}>
          <button onClick={openCamera} className={styles.mainButton}>
            <FaCamera className={styles.buttonIcon} />
            Open Camera
          </button>
          
          <div className={styles.scriptSetup}>
            <h3>Prepare Your Script</h3>
            <textarea
              value={script}
              onChange={handleScriptChange}
              className={styles.scriptInput}
              placeholder="Enter your script here..."
              rows={6}
            />
          </div>
        </div>
      ) : (
        <div className={styles.cameraContainer}>
          <Webcam
            ref={webcamRef}
            audio={true}
            muted={true}
            className={styles.webcam}
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: "user"
            }}
            mirrored={true}
          />
          
          {countdown !== null && (
            <div className={styles.countdownOverlay}>
              <div className={styles.countdownNumber}>
                {countdown === 0 ? 'GO!' : countdown}
              </div>
            </div>
          )}

          {showTeleprompter && script && (
            <div className={styles.teleprompterContainer}>
              {isEditingScript ? (
                <textarea
                  value={script}
                  onChange={handleScriptChange}
                  className={styles.teleprompterEdit}
                />
              ) : (
                <div className={styles.teleprompterScroll} ref={prompterRef}>
                  <div className={styles.teleprompterText}>
                    {script}
                  </div>
                </div>
              )}
              
              <div className={styles.teleprompterControls}>
                <button 
                  onClick={() => adjustScrollSpeed(0.5)} 
                  className={styles.speedButton}
                  disabled={!isRecording || isPaused}
                >
                  <FaArrowUp />
                </button>
                <span className={styles.speedDisplay}>
                  Speed: {scrollSpeed.toFixed(1)}
                </span>
                <button 
                  onClick={() => adjustScrollSpeed(-0.5)} 
                  className={styles.speedButton}
                  disabled={!isRecording || isPaused}
                >
                  <FaArrowDown />
                </button>
                <button 
                  onClick={toggleScriptEdit} 
                  className={styles.editButton}
                  disabled={isRecording}
                >
                  <FaEdit />
                </button>
              </div>
            </div>
          )}

          <div className={styles.controls}>
            {isRecording ? (
              <>
                {isPaused ? (
                  <button onClick={resumeRecording} className={`${styles.controlButton} ${styles.resumeButton}`}>
                    <FaPlay className={styles.buttonIcon} />
                    Resume
                  </button>
                ) : (
                  <button onClick={pauseRecording} className={`${styles.controlButton} ${styles.pauseButton}`}>
                    <FaPause className={styles.buttonIcon} />
                    Pause
                  </button>
                )}
                <button onClick={stopRecording} className={`${styles.controlButton} ${styles.stopButton}`}>
                  <FaStop className={styles.buttonIcon} />
                  Stop
                </button>
              </>
            ) : (
              <button 
                onClick={startRecording} 
                className={`${styles.controlButton} ${styles.recordButton}`}
                disabled={countdown !== null}
              >
                <FaPlay className={styles.buttonIcon} />
                Start Recording
              </button>
            )}
            
            <button 
              onClick={closeCamera} 
              className={`${styles.controlButton} ${styles.closeButton}`}
              disabled={countdown !== null}
            >
              <FaTimes className={styles.buttonIcon} />
              Close Camera
            </button>
          </div>

          {isRecording && (
            <div className={`${styles.timer} ${isPaused ? styles.timerPaused : ''}`}>
              {formatTime(recordTime)}
            </div>
          )}
        </div>
      )}

      {videoURL && (
        <div className={styles.videoPreview}>
          <h3 className={styles.previewTitle}>Recorded Video</h3>
          <video src={videoURL} controls className={styles.previewVideo} />
          <button onClick={saveVideo} className={`${styles.controlButton} ${styles.saveButton}`}>
            <FaSave className={styles.buttonIcon} />
            Save Video
          </button>
        </div>
      )}
    </div>
  );
};

export default Recorder;
