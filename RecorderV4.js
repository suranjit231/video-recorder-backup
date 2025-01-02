import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FaCamera, FaStop, FaPlay, FaTimes, FaSave, FaPause, FaArrowUp, FaArrowDown, FaSync } from 'react-icons/fa';
import { MdOutlineFilterVintage } from "react-icons/md";

import styles from './Recorder.module.css';
import { useVideoRecorder } from '../../context/VideoRecorderContext'; 
import FilterVideo from '../filter/FilterVideo';

const Recorder = () => {

  const {
    isCameraOpen, 
    setIsCameraOpen,
    toggleActiveFilter,
    isFilterMode,
    activeFilter} = useVideoRecorder();

    // Add canvas ref for filter processing
    const canvasRef = useRef(null);
    const frameProcessingRef = useRef(null);

  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [videoURL, setVideoURL] = useState(null);
  const [videoList, setVideoList] = useState([]); 
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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const errorTimeoutRef = useRef(null);

  useEffect(() => {
    if (error) {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setError(null);
      }, 1500); 
    }
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [error]);


  //============== Add frame processing function ========================//
 // First, modify processVideoFrame:
const processVideoFrame = useCallback(() => {
  if (webcamRef.current?.video && canvasRef.current) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas size once
      if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
      }

      // Clear previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Reset any previous filters
      ctx.filter = 'none';
      // Draw the original frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Apply filter if active
      if (activeFilter && activeFilter.filter !== 'none') {
          // Create temporary canvas for filter application
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          
          // Copy current frame
          tempCtx.drawImage(canvas, 0, 0);
          
          // Clear main canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Apply filter and draw
          ctx.filter = activeFilter.filter;
          ctx.drawImage(tempCanvas, 0, 0);
      }

      // Request next frame
      frameProcessingRef.current = requestAnimationFrame(processVideoFrame);
  }
}, [activeFilter]);



  // ========= scrolling the scripts features =======================//
  const startScriptScrolling = useCallback(() => {
    if (scrollInterval.current) clearInterval(scrollInterval.current);
    scrollInterval.current = setInterval(() => {
      if (prompterRef.current) {
        prompterRef.current.scrollTop += scrollSpeed;
      }
    }, 50);
  }, [scrollSpeed]);


  // ========== stop scrolling the scripts fetature =================//
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
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }

      const constraints = {
        audio: true,
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          aspectRatio: { ideal: 16/9 }
        }
      };

      console.log('Getting stream with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got stream:', stream.getTracks());

      streamRef.current = stream;
      
      if (webcamRef.current) {
        webcamRef.current.stream = stream;
        if (webcamRef.current.video) {
          webcamRef.current.video.srcObject = stream;
        }
      }

      setIsCameraOpen(true);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access failed. Please check camera permissions and try again.');
    }
  };

  const toggleCamera = async () => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }

      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);

      const constraints = {
        audio: true,
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          aspectRatio: { ideal: 16 / 9 }
        }
      };

      console.log('Toggling camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got new stream:', stream.getTracks());

      streamRef.current = stream;
      if (webcamRef.current) {
        webcamRef.current.stream = stream;
        if (webcamRef.current.video) {
          webcamRef.current.video.srcObject = stream;
        }
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
      setError('Failed to switch camera. Please try again.');
    }
  };

  const startRecording = () => {
    if (!webcamRef.current || !webcamRef.current.stream) {
      setError('No active stream found');
      return;
    }
    setCountdown(3);
  };

  // const startActualRecording = () => {
  //   try {
  //     if (!webcamRef.current || !webcamRef.current.stream) {
  //       console.error('No webcam stream available');
  //       throw new Error('Camera stream not available');
  //     }

  //      //========= Start frame processing if not already started =================//
  //      if (!frameProcessingRef.current) {
  //       processVideoFrame();
  //   }

  //   // Get processed stream from canvas
  //   const processedStream = canvasRef.current.captureStream(30);

  //     const stream = webcamRef.current.stream;
  //     console.log('Recording stream tracks:', stream.getTracks());

  //     const videoTracks = stream.getVideoTracks();
  //     const audioTracks = stream.getAudioTracks();

  //     if (videoTracks.length === 0) {
  //       throw new Error('No video track available');
  //     }
  //     if (audioTracks.length === 0) {
  //       throw new Error('No audio track available');
  //     }

  //     setIsRecording(true);
  //     setIsPaused(false);
  //     setRecordedChunks([]);
  //     setCountdown(null);

  //     let options = {};
  //     const mimeTypes = [
  //       'video/webm;codecs=h264,opus',
  //       'video/webm;codecs=vp8,opus',
  //       'video/webm',
  //       'video/mp4'
  //     ];

  //     let selectedMimeType = null;
  //     for (const mimeType of mimeTypes) {
  //       if (MediaRecorder.isTypeSupported(mimeType)) {
  //         selectedMimeType = mimeType;
  //         break;
  //       }
  //     }

  //     if (!selectedMimeType) {
  //       throw new Error('No supported recording format found');
  //     }

  //     options = {
  //       mimeType: selectedMimeType,
  //       videoBitsPerSecond: 2500000,
  //       audioBitsPerSecond: 128000
  //     };

  //     console.log('Starting recording with options:', options);
  //     const mediaRecorder = new MediaRecorder(stream, options);
  //     mediaRecorderRef.current = mediaRecorder;

  //     const chunks = [];
  //     mediaRecorder.ondataavailable = (e) => {
  //       if (e.data && e.data.size > 0) {
  //         chunks.push(e.data);
  //         setRecordedChunks(prevChunks => [...prevChunks, e.data]);
  //       }
  //     };

  //     mediaRecorder.onstop = () => {
  //       try {
  //         if (chunks.length > 0) {
  //           const blob = new Blob(chunks, { type: selectedMimeType });
  //           if (videoURL) {
  //             URL.revokeObjectURL(videoURL);
  //           }
  //           const url = URL.createObjectURL(blob);
  //           setVideoURL(url);
  //           setVideoList(prevList => [{ blob, url, timestamp: new Date().toLocaleString() }, ...prevList]);
  //         }
  //       } catch (error) {
  //         console.error('Error creating video blob:', error);
  //         setError('Failed to save the recording. Please try again.');
  //       }
  //     };

  //     mediaRecorder.start(1000);
      
  //     const interval = setInterval(() => {
  //       setRecordTime(prevTime => prevTime + 1);
  //     }, 1000);
  //     setTimerInterval(interval);
  //   } catch (err) {
  //     console.error('Recording error:', err);
  //     setError('Failed to start recording: ' + err.message);
  //     setIsRecording(false);
  //   }
  // };





 

  // Then, update startActualRecording:
const startActualRecording = () => {
  try {
      if (!webcamRef.current?.video || !canvasRef.current) {
          throw new Error('Camera or canvas not available');
      }

      // Ensure canvas is properly sized
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Start frame processing if not already started
      if (!frameProcessingRef.current) {
          processVideoFrame();
      }

      // Create a stream from the canvas
      const processedStream = canvas.captureStream(30);

      // Add audio from original stream
      const audioTrack = webcamRef.current.stream.getAudioTracks()[0];
      if (audioTrack) {
          processedStream.addTrack(audioTrack.clone());
      }

      setIsRecording(true);
      setIsPaused(false);
      setRecordedChunks([]);
      setCountdown(null);

      // Find supported mime type
      const mimeTypes = [
          'video/webm;codecs=h264,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4'
      ];

      let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (!selectedMimeType) {
          throw new Error('No supported recording format found');
      }

      const options = {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 2500000,
          audioBitsPerSecond: 128000
      };

      const mediaRecorder = new MediaRecorder(processedStream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
              chunks.push(e.data);
              setRecordedChunks(prevChunks => [...prevChunks, e.data]);
          }
      };

      mediaRecorder.onstop = () => {
          try {
              if (chunks.length > 0) {
                  const blob = new Blob(chunks, { type: selectedMimeType });
                  if (videoURL) {
                      URL.revokeObjectURL(videoURL);
                  }
                  const url = URL.createObjectURL(blob);
                  setVideoURL(url);
                  setVideoList(prevList => [
                      { blob, url, timestamp: new Date().toLocaleString() },
                      ...prevList
                  ]);
              }

              // Clean up frame processing
              if (frameProcessingRef.current) {
                  cancelAnimationFrame(frameProcessingRef.current);
                  frameProcessingRef.current = null;
              }
          } catch (error) {
              console.error('Error creating video blob:', error);
              setError('Failed to save the recording. Please try again.');
          }
      };

      // Start recording
      mediaRecorder.start(1000);
      
      // Setup recording timer
      const interval = setInterval(() => {
          setRecordTime(prevTime => prevTime + 1);
      }, 1000);
      setTimerInterval(interval);

  } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording: ' + err.message);
      setIsRecording(false);
      
      // Cleanup on error
      if (frameProcessingRef.current) {
          cancelAnimationFrame(frameProcessingRef.current);
          frameProcessingRef.current = null;
      }
  }
};








  const handlePlayedVideoFromList = (video, idx) => {
    setSelectedVideo(video);
    setVideoURL(video.url);
    setIsPreviewMode(true);
  };

  const saveVideo = () => {
    if (!selectedVideo) {
      setError('Please select a video to save first');
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = selectedVideo.url;
      a.download = `video_${selectedVideo.timestamp.replace(/[/:\\]/g, '-')}.webm`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error saving video:', error);
      setError('Failed to save video. Please try again.');
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

  // const handlePreview = () => {
  //   if (recordedChunks.length) {
  //     const blob = new Blob(recordedChunks, { type: 'video/webm' });
  //     if (videoURL) {
  //       URL.revokeObjectURL(videoURL);
  //     }
  //     const url = URL.createObjectURL(blob);
  //     setVideoURL(url);
  //     setIsPreviewMode(true);
  //   }
  // };

  const closePreview = () => {
    setIsPreviewMode(false);
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
              {selectedVideo && (
                <button
                  onClick={saveVideo}
                  className={`${styles.controlButton} ${styles.saveButton}`}
                >
                  <FaSave className={styles.buttonIcon} />
                </button>
              )}
              <button
                onClick={closePreview}
                className={`${styles.controlButton} ${styles.closeButton}`}
              >
                <FaTimes className={styles.buttonIcon} />
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
              mirrored={facingMode === 'user'}
              videoConstraints={{
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                aspectRatio: { ideal: 16/9 }
              }}
            />

             <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
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
              {!isRecording && videoList.length > 0 && (
                <div className={styles.videoListContainer}>
                  {videoList.map((video, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handlePlayedVideoFromList(video, idx)} 
                      className={`${styles.videoListItem} ${selectedVideo === video ? styles.selectedVideo : ''}`}
                    >
                      <video
                        src={video.url}
                        className={styles.thumbnailVideo}
                      />
                      <div className={styles.videoInfo}>
                        <span>Recording {idx + 1}</span>
                        <small>{video.timestamp}</small>
                      </div>
                      <div className={styles.playIconOverlay}>
                        <FaPlay className={styles.playIcon} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ========== rendering filter list here=================== */}

              { isFilterMode && <FilterVideo webcamRef={webcamRef} canvasRef={canvasRef}  />}

              

              <div className={styles.controlButtonBox}>

                { isCameraOpen && (
                  

                   <div onClick={()=>toggleActiveFilter()} className={`${styles.filterButton}`} >
                  <MdOutlineFilterVintage />
                   </div>
                )}

                {isRecording ? (
                  <>
                    <button
                      onClick={togglePause}
                      className={`${styles.controlButton} ${isPaused ? styles.resumeButton : styles.pauseButton}`}
                    >
                      {isPaused ? <FaPlay className={styles.buttonIcon} /> : <FaPause className={styles.buttonIcon} />}
                    </button>
                    <button
                      onClick={stopRecording}
                      className={`${styles.controlButton} ${styles.stopButton}`}
                    >
                      <FaStop className={styles.buttonIcon} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startRecording}
                      className={`${styles.controlButton} ${styles.recordButton}`}
                      disabled={countdown !== null}
                    >
                      <FaCamera className={styles.buttonIcon} />
                    </button>
                    <button
                      onClick={toggleCamera}
                      className={`${styles.controlButton} ${styles.cameraToggleButton}`}
                      disabled={countdown !== null}
                    >
                      <FaSync className={styles.buttonIcon} />
                    </button>
                  </>
                )}

                <button
                  onClick={closeCamera}
                  className={`${styles.controlButton} ${styles.closeButton}`}
                  disabled={countdown !== null}
                >
                  <FaTimes className={styles.buttonIcon} />
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
