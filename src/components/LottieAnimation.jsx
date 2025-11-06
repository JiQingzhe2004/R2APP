import { useEffect, useRef } from 'react';
import { DotLottie } from '@lottiefiles/dotlottie-web';

/**
 * Lottie 动画组件
 * @param {string} src - Lottie 文件的路径（支持 .json 或 .lottie 格式）
 * @param {boolean} autoplay - 是否自动播放，默认 true
 * @param {boolean} loop - 是否循环播放，默认 true
 * @param {number} speed - 播放速度，默认 1
 * @param {string} className - 容器的 CSS 类名
 * @param {Object} style - 容器的内联样式
 */
export default function LottieAnimation({ 
  src, 
  autoplay = true, 
  loop = true, 
  speed = 1,
  className = '',
  style = {}
}) {
  const canvasRef = useRef(null);
  const dotLottieRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !src) return;

    // 初始化 DotLottie
    dotLottieRef.current = new DotLottie({
      canvas: canvasRef.current,
      src,
      autoplay,
      loop,
      speed,
    });

    // 清理函数
    return () => {
      if (dotLottieRef.current) {
        dotLottieRef.current.destroy();
        dotLottieRef.current = null;
      }
    };
  }, [src, autoplay, loop, speed]);

  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}

