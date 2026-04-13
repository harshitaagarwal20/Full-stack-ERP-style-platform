import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 900;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export default useIsMobile;
