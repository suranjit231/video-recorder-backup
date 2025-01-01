import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FaCamera, FaStop, FaPlay, FaTimes, FaSave, FaPause, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import styles from './Recorder.module.css';

const Recorder = () => {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [videoURL, setVideoURL] = useState(null);
  const [videoList, setVideoList] = useState([]); 
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordTime, setRecordTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [error, setError] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const streamRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  const [script, setScript] = useState('');
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const prompterRef = useRef(null);
  const scrollInterval = useRef(null);

  const startScriptScrolling = useCallback(() => {
    if (scrollInterval.current) clearInterval(scrollInterval.current);
    scrollInterval.current = setInterval(() => {
      if (prompterRef.current) {
        prompterRef.current.scrollTop += scrollSpeed;
      }
    }, 50);
  }, [scrollSpeed]);

  const stopScriptScrolling = useCallback(() => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  const adjustScrollSpeed = (change) => {
    setScrollSpeed(prev => Math.max(0.5, Math.min(10, prev + change)));
  };

  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
      if (videoURL) URL.revokeObjectURL(videoURL);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    };
  }, [timerInterval, videoURL]);

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

  useEffect(() => {
    if (isRecording && !isPaused && prompterRef.current) {
      startScriptScrolling();
    } else {
      stopScriptScrolling();
    }
  }, [isRecording, isPaused, startScriptScrolling, stopScriptScrolling]);

  const openCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Mobile-specific constraints
      const mobileConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: 'user',
          width: { min: 320, ideal: 720, max: 1280 },
          height: { min: 240, ideal: 1280, max: 1920 },
          frameRate: { min: 15, ideal: 24 },
          aspectRatio: { ideal: 0.5625 } // 9:16 aspect ratio for mobile
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
        
        // Apply mobile-specific settings to video track
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          // Force mobile-friendly settings
          await videoTrack.applyConstraints({
            width: { ideal: 720 },
            height: { ideal: 1280 },
            frameRate: 24
          });
        }

        streamRef.current = stream;
        
        // Directly set the stream to video element for better mobile compatibility
        if (webcamRef.current && webcamRef.current.video) {
          webcamRef.current.video.srcObject = stream;
        }
        
        setIsCameraOpen(true);
        setError(null);
      } catch (err) {
        console.log('Falling back to basic constraints', err);
        
        // Fallback constraints for older devices
        const fallbackConstraints = {
          audio: true,
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        streamRef.current = stream;
        
        if (webcamRef.current && webcamRef.current.video) {
          webcamRef.current.video.srcObject = stream;
        }
        
        setIsCameraOpen(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access failed. Please check camera permissions and try again.');
    }
  };

  const startRecording = () => {
    if (!webcamRef.current || !webcamRef.current.stream) {
      setError('No active stream found');
      return;
    }
    setCountdown(3);
  };

  const startActualRecording = () => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setRecordedChunks([]);
      setCountdown(null);

      // Get the stream from webcam
      const stream = webcamRef.current.stream;
      if (!stream) {
        throw new Error('No active stream found');
      }

      // Try different MIME types for better mobile compatibility
      let options = {};
      const mimeTypes = [
        'video/mp4;codecs=h264,aac',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];

      // Find the first supported MIME type
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = {
            mimeType,
            videoBitsPerSecond: 1000000, // 1 Mbps for better mobile performance
            audioBitsPerSecond: 128000
          };
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          const mimeType = mediaRecorder.mimeType || 'video/webm';
          const blob = new Blob(chunks, { type: mimeType });
          
          if (videoURL) {
            URL.revokeObjectURL(videoURL);
          }
          
          const url = URL.createObjectURL(blob);
          setVideoURL(url);
          setVideoList((prevList) => [blob, ...prevList]);
        } catch (error) {
          console.error('Error creating video blob:', error);
          setError('Failed to save the recording. Please try again.');
        }
      };

      // Use larger chunks for mobile to reduce processing overhead
      mediaRecorder.start(1000); // 1 second chunks

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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        clearInterval(timerInterval);
        setTimerInterval(null);
      } else {
        mediaRecorderRef.current.resume();
        const interval = setInterval(() => {
          setRecordTime(prevTime => prevTime + 1);
        }, 1000);
        setTimerInterval(interval);
      }
      setIsPaused(prev => !prev);
    }
  };

  const handlePreview = () => {
    if (recordedChunks.length) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      if (videoURL) {
        URL.revokeObjectURL(videoURL);
      }
      const url = URL.createObjectURL(blob);
      setVideoURL(url);
      setIsPreviewMode(true);
    }
  };

  // ====== handle clicked played video ======//
  function handlePlayedVideoFromList(blob, idx) {
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }
    const url = URL.createObjectURL(blob);
    setVideoURL(url);
    setIsPreviewMode(true);
  }

  const closePreview = () => {
    setIsPreviewMode(false);
  };

  const saveVideo = () => {
    if (recordedChunks.length) {
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
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setIsRecording(false);
    setIsPaused(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setRecordTime(0);
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
      setVideoURL(null);
    }
    setRecordedChunks([]);
    setError(null);
    setCountdown(null);
    setIsPreviewMode(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.mobileContainer}>
        {!isCameraOpen ? (
          <div className={styles.setupContainer}>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className={styles.scriptInput}
              placeholder="Enter your script here (optional)..."
            />
            <button className={styles.primaryButton} onClick={openCamera}>
              <FaCamera className={styles.buttonIcon} />
              Open Camera
            </button>
          </div>
        ) : isPreviewMode ? (
          <div className={styles.previewContainer}>
            <video 
              src={videoURL} 
              controls 
              className={styles.previewVideo}
              autoPlay
            />
            <div className={styles.previewControls}>
              <button
                onClick={saveVideo}
                className={`${styles.controlButton} ${styles.saveButton}`}
              >
                <FaSave className={styles.buttonIcon} />
                Save Video
              </button>
              <button
                onClick={closePreview}
                className={`${styles.controlButton} ${styles.closeButton}`}
              >
                <FaTimes className={styles.buttonIcon} />
                Close Preview
              </button>
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
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
              }}
            />
            
            {isRecording && (
              <div className={`${styles.timer} ${isPaused ? styles.timerPaused : ''}`}>
                {formatTime(recordTime)}
              </div>
            )}

            {countdown !== null && (
              <div className={styles.countdownOverlay}>
                <div className={styles.countdownNumber}>{countdown}</div>
              </div>
            )}

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            {script && isRecording && (
              <div className={styles.teleprompterContainer}>
                <div ref={prompterRef} className={styles.teleprompterScroll}>
                  <div className={styles.teleprompterText}>{script}</div>
                </div>
                <div className={styles.speedControls}>
                  <button
                    onClick={() => adjustScrollSpeed(0.5)}
                    className={styles.speedButton}
                    disabled={isPaused}
                  >
                    <FaArrowUp className={styles.buttonIcon} />
                  </button>
                  <button
                    onClick={() => adjustScrollSpeed(-0.5)}
                    className={styles.speedButton}
                    disabled={isPaused}
                  >
                    <FaArrowDown className={styles.buttonIcon} />
                  </button>
                </div>
              </div>
            )}

            <div className={styles.controls}>
              {/* {!isRecording && !videoURL && (
                <button
                  onClick={startRecording}
                  className={`${styles.controlButton} ${styles.recordButton}`}
                  disabled={countdown !== null}
                >
                  <FaCamera className={styles.buttonIcon} />
                  Record
                </button>
              )} */}

              {/* {isRecording && (
                <>
                  <button
                    onClick={togglePause}
                    className={`${styles.controlButton} ${isPaused ? styles.resumeButton : styles.pauseButton}`}
                  >
                    <FaPause className={styles.buttonIcon} />
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopRecording}
                    className={`${styles.controlButton} ${styles.stopButton}`}
                  >
                    <FaStop className={styles.buttonIcon} />
                    Stop
                  </button>
                </>
              )} */}

              {!isRecording && videoURL && (
                <>
                  {/* ----- show the list of videos already recorded------- */}
                  <div className={styles.videoListContainer}>
                    {videoList && videoList?.length > 0 && videoList.map((blob, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handlePlayedVideoFromList(blob, idx)} 
                        className={styles.videoListItem}
                      >
                        <video
                          src={URL.createObjectURL(blob)}
                          className={styles.thumbnailVideo}
                        />
                        <div className={styles.playIconOverlay}>
                          <FaPlay className={styles.playIcon} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {isPreviewMode && videoURL && (
                    <div className={styles.previewContainer}>
                      <video 
                        key={videoURL}
                        src={videoURL} 
                        controls 
                        className={styles.previewVideo}
                        autoPlay 
                      />
                    </div>
                  )}

                 
                </>
              )}

              <div className={styles.controlButtonBox}>


              {isRecording && (
                <>
                  <button
                    onClick={togglePause}
                    className={`${styles.controlButton} ${isPaused ? styles.resumeButton : styles.pauseButton}`}
                  >
                    <FaPause className={styles.buttonIcon} />
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopRecording}
                    className={`${styles.controlButton} ${styles.stopButton}`}
                  >
                    <FaStop className={styles.buttonIcon} />
                    Stop
                  </button>
                </>
              )}


              {!isRecording && (
                <button
                  onClick={startRecording}
                  className={`${styles.controlButton} ${styles.recordButton}`}
                  disabled={countdown !== null}
                >
                  <FaCamera className={styles.buttonIcon} />
                  Record
                </button>
              )}


                {!isRecording && videoURL && (

                    <button
                    onClick={saveVideo}
                    className={`${styles.controlButton} ${styles.saveButton}`}
                  >
                    <FaSave className={styles.buttonIcon} />
                    Save
                  </button>

                )}

              <button
                onClick={closeCamera}
                className={`${styles.controlButton} ${styles.closeButton}`}
                disabled={countdown !== null}
              >
                <FaTimes className={styles.buttonIcon} />
                Close
              </button>


                
              </div>

           
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Recorder;
