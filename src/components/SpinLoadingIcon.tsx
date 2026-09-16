export function SpinLoadingIcon() {
  return (
    <div className="inline-flex items-center justify-center w-10 h-10">
      <div className="relative w-10 h-10 animate-[rotating_1s_linear_infinite]">
        {/* Close ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-[#d1cdb7]" />
        {/* Outer ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full border-[6px] border-[#d1cdb7] opacity-30" />
        {/* Spin ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full border-[3px] border-transparent border-r-[#d1cdb7]" />
        {/* Inner circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] h-[35%] rounded-full bg-[#d1cdb7]" />
      </div>
    </div>
  );
}
