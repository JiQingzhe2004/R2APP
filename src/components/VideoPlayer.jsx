import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { MorphingMenu } from "@/components/ui/morphing-menu";

function formatTime(seconds) {
  if (!seconds) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const CustomSlider = ({ value, max, onChange, className }) => {
  const handleChange = (e) => {
    onChange(parseFloat(e.target.value));
  };

  const percentage = (value / max) * 100;

  return (
    <div className={cn("relative flex items-center select-none touch-none w-full h-5 group", className)}>
      <input
        type="range"
        min="0"
        max={max}
        step="any"
        value={value}
        onChange={handleChange}
        className="absolute w-full h-full opacity-0 z-10 cursor-pointer"
      />
      <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
        <div 
          className="h-full bg-primary transition-all" 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div 
        className="absolute h-3 w-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ left: `calc(${percentage}% - 6px)` }}
      />
    </div>
  );
};

export function VideoPlayer({ src, poster, autoPlay = false, className }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [isRateMenuOpen, setIsRateMenuOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleError = () => setError("视频加载失败");
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay failed, likely interaction required
        setIsPlaying(false);
      });
    }
  }, [autoPlay]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleSeek = (value) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const handleVolumeChange = (value) => {
    if (videoRef.current) {
      const newVolume = parseFloat(value);
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      } else if (newVolume === 0 && !isMuted) {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 500);
    }
  };

  const changePlaybackRate = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const skip = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative group bg-black overflow-hidden flex flex-col justify-center", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        // Toggle play if clicking on video area (not controls)
        // handled by overlay
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Loading Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-red-500 flex flex-col items-center gap-2">
            <span className="text-lg font-medium">{error}</span>
            <Button variant="outline" size="sm" onClick={() => {
              if(videoRef.current) {
                videoRef.current.load();
                setError(null);
              }
            }}>重试</Button>
          </div>
        </div>
      )}

      {/* Center Play Button (only when paused or waiting interaction) */}
      {!isPlaying && !isBuffering && !error && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-10"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all transform hover:scale-110">
            <Play className="w-8 h-8 text-white fill-current" />
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 z-20",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress Bar */}
        <div className="mb-2">
          <CustomSlider 
            value={currentTime}
            max={duration || 100}
            onChange={handleSeek}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 rounded-full" onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </Button>
            
            <div className="flex items-center gap-1 group/volume relative mx-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 rounded-full" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 flex items-center">
                 <CustomSlider 
                  value={isMuted ? 0 : volume}
                  max={1}
                  onChange={handleVolumeChange}
                  className="w-20 mx-2"
                />
              </div>
            </div>

            <div className="text-white/90 text-xs font-mono select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
             <MorphingMenu
              className="w-12 h-8"
              triggerClassName="text-white hover:bg-white/20 rounded-full bg-transparent border-0"
              direction="bottom-right"
              expandedWidth={80}
              collapsedRadius="16px"
              expandedRadius="12px"
              isOpen={isRateMenuOpen}
              onOpenChange={setIsRateMenuOpen}
              contentClassName="bg-black/90 text-white border-white/10"
              trigger={
                <div className="flex w-full h-full items-center justify-center text-xs font-medium">
                  {playbackRate}x
                </div>
              }
            >
              <div className="flex flex-col gap-1 p-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <div
                    key={rate}
                    onClick={(e) => {
                      e.stopPropagation();
                      changePlaybackRate(rate);
                      setIsRateMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-center rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-white/20 transition-colors",
                      playbackRate === rate && "bg-white/20 font-bold"
                    )}
                  >
                    {rate}x
                  </div>
                ))}
              </div>
            </MorphingMenu>

            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8 rounded-full" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
