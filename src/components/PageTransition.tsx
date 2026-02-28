import { useEffect, useRef } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Force reflow to trigger animation on route change
    if (nodeRef.current) {
      nodeRef.current.classList.remove("page-transition");
      void nodeRef.current.offsetWidth; // Trigger reflow
      nodeRef.current.classList.add("page-transition");
    }
  }, [children]);

  return (
    <div ref={nodeRef} className="page-transition">
      {children}
    </div>
  );
}
