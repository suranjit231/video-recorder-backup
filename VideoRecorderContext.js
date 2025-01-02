import { useContext, createContext, useState } from "react";


const AdvancedVideoRecorderContext = createContext();

export function useVideoRecorder() {
    return useContext(AdvancedVideoRecorderContext);
}


// ======== video recorder advanced feature provider ===============//

export function VideoRecorderProvider({ children }) {
   
   // const [activeFilter, setActiveFilter] = useState(null);
   const [activeFilter, setActiveFilter] = useState({
    id: 'normal',
    name: 'Normal',
    filter: 'none',
    background: 'linear-gradient(45deg, #3498db, #2ecc71)'
});

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isFilterMode, setIsFilterMode] = useState(false);

    function toggleActiveFilter(){
        setIsFilterMode(prevState => !prevState);

    }

    return (
        <AdvancedVideoRecorderContext.Provider
         value={{ activeFilter,
          setActiveFilter,
          isCameraOpen, 
          setIsCameraOpen,
          toggleActiveFilter,
          isFilterMode
          }}>
            {children}
        </AdvancedVideoRecorderContext.Provider>
    );
}
