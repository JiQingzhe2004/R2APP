import { useEffect, useRef } from 'react';
import { DotLottie } from '@lottiefiles/dotlottie-web';
import SuccessLottie from '@/assets/lottie/Success.lottie';

/**
 * 成功动画覆盖层（屏幕中央的 Success 对勾）
 * @param {boolean} isVisible - 是否显示动画
 * @param {function} onComplete - 动画完成时的回调
 */
export default function ConfettiOverlay({ isVisible, onComplete }) {
  const successCanvasRef = useRef(null);
  const successRef = useRef(null);

  useEffect(() => {
    if (!isVisible || !successCanvasRef.current) return;

    // 初始化 Success 动画（中间对勾）
    successRef.current = new DotLottie({
      canvas: successCanvasRef.current,
      src: SuccessLottie,
      autoplay: true,
      loop: false,
      speed: 1,
    });

    // 监听动画完成事件
    const handleComplete = () => {
      if (onComplete) {
        onComplete();
      }
    };

    successRef.current.addEventListener('complete', handleComplete);

    // 清理函数
    return () => {
      if (successRef.current) {
        successRef.current.removeEventListener('complete', handleComplete);
        successRef.current.destroy();
        successRef.current = null;
      }
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
      style={{
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
      }}
    >
      {/* Success 对勾动画（屏幕中央）*/}
      <div
        style={{
          width: '300px',
          height: '300px',
        }}
      >
        <canvas 
          ref={successCanvasRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}

