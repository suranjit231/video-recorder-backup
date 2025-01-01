import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FaCamera, FaStop, FaPlay, FaTimes, FaSave, FaPause, FaArrowUp, FaArrowDown, FaSync } from 'react-icons/fa';
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
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

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
      // Clean up existing streams
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }

      // Set constraints for the camera
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

      // Store stream in refs
      streamRef.current = stream;
      
      // Update Webcam component's stream
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
      // Stop existing stream first
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
      }

      // Toggle camera mode
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);

      // Get new stream with updated facing mode
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

      // Update stream refs
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

  console.log("facingMode in line 163: ", facingMode )

  const startRecording = () => {
    if (!webcamRef.current || !webcamRef.current.stream) {
      setError('No active stream found');
      return;
    }
    setCountdown(3);
  };

  const startActualRecording = () => {
    try {
      // Check stream availability
      if (!webcamRef.current || !webcamRef.current.stream) {
        console.error('No webcam stream available');
        throw new Error('Camera stream not available');
      }

      const stream = webcamRef.current.stream;
      console.log('Recording stream tracks:', stream.getTracks());

      // Verify tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      if (videoTracks.length === 0) {
        throw new Error('No video track available');
      }
      if (audioTracks.length === 0) {
        throw new Error('No audio track available');
      }

      setIsRecording(true);
      setIsPaused(false);
      setRecordedChunks([]);
      setCountdown(null);

      // Try different MIME types
      let options = {};
      const mimeTypes = [
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];

      let selectedMimeType = null;
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported recording format found');
      }

      options = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      };

      console.log('Starting recording with options:', options);
      const mediaRecorder = new MediaRecorder(stream, options);
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
            setVideoList(prevList => [{ blob, url, timestamp: new Date().toLocaleString() }, ...prevList]);
          }
        } catch (error) {
          console.error('Error creating video blob:', error);
          setError('Failed to save the recording. Please try again.');
        }
      };

      mediaRecorder.start(1000);
      
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
              {selectedVideo && (
                <button
                  onClick={saveVideo}
                  className={`${styles.controlButton} ${styles.saveButton}`}
                >
                  <FaSave className={styles.buttonIcon} />
                  Save Video
                </button>
              )}
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
              mirrored={facingMode === 'user'}
              videoConstraints={{
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                aspectRatio: { ideal: 16/9 }
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
                  <>
                    <button
                      onClick={startRecording}
                      className={`${styles.controlButton} ${styles.recordButton}`}
                      disabled={countdown !== null}
                    >
                      <FaCamera className={styles.buttonIcon} />
                      Record
                    </button>
                    <button
                      onClick={toggleCamera}
                      className={`${styles.controlButton} ${styles.cameraToggleButton}`}
                      disabled={countdown !== null}
                    >
                      <FaSync className={styles.buttonIcon} />
                      Switch Camera
                    </button>
                  </>
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
