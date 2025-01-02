// FilterVideo.jsx
import React from 'react';
import { useVideoRecorder } from '../../context/VideoRecorderContext';
import styles from './FilterVideo.module.css';

const filters = [
  {
    id: 'normal',
    name: 'Normal',
    filter: 'none',
    background: 'linear-gradient(45deg, #3498db, #2ecc71)'
  },
  {
    id: 'warm',
    name: 'Warm',
    filter: 'sepia(0.5) saturate(1.5) hue-rotate(330deg)',
    background: 'linear-gradient(45deg, #e67e22, #f1c40f)'
  },
  {
    id: 'cool',
    name: 'Cool',
    filter: 'saturate(1.2) hue-rotate(180deg) brightness(1.1)',
    background: 'linear-gradient(45deg, #3498db, #2980b9)'
  },
  {
    id: 'vintage',
    name: 'Vintage',
    filter: 'sepia(0.8) contrast(1.2) saturate(0.8) brightness(0.9)',
    background: 'linear-gradient(45deg, #d35400, #c0392b)'
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    filter: 'contrast(1.4) saturate(1.4) brightness(0.9)',
    background: 'linear-gradient(45deg, #8e44ad, #2c3e50)'
  },
  {
    id: 'bw',
    name: 'B&W',
    filter: 'grayscale(1) contrast(1.2)',
    background: 'linear-gradient(45deg, #2c3e50, #7f8c8d)'
  },
  {
    id: 'fade',
    name: 'Fade',
    filter: 'brightness(1.1) saturate(0.8) contrast(0.9)',
    background: 'linear-gradient(45deg, #95a5a6, #bdc3c7)'
  },
  {
    id: 'sharp',
    name: 'Sharp',
    filter: 'contrast(1.3) brightness(1.1) saturate(1.3)',
    background: 'linear-gradient(45deg, #16a085, #27ae60)'
  }
];

export default function FilterVideo() {
  const { activeFilter, setActiveFilter } = useVideoRecorder();

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    // Apply filter to video element
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.style.filter = filter.filter;
    }
  };

  return (
    <div className={styles.filterListContainer}>
      {filters.map((filter) => (
        <div
          key={filter.id}
          className={`${styles.filterItem} ${
            activeFilter?.id === filter.id ? styles.activeFilter : ''
          }`}
          onClick={() => handleFilterChange(filter)}
        >
          <div 
            className={styles.filterPreview}
            style={{ 
              background: filter.background,
              filter: filter.filter 
            }}
          />
          <span className={styles.filterName}>{filter.name}</span>
        </div>
      ))}
    </div>
  );
}
