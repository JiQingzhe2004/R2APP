import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Send, Loader2 } from "lucide-react";

export default function ChatInput({
  inputMessage,
  setInputMessage,
  handleSendMessage,
  isLoading,
  selectedConfig
}) {
  const textareaRef = useRef(null);

  // 自动高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // 重置高度
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"; // 根据内容调整
      
      // 根据高度动态调整圆角
      const height = textareaRef.current.scrollHeight;
      if (height > 44) {
        textareaRef.current.style.borderRadius = "25px"; // 多行时使用中等圆角
      } else {
        textareaRef.current.style.borderRadius = "25px"; // 单行时使用完全圆角
      }
    }
  }, [inputMessage]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t bg-card p-4">
      <div className="relative flex items-end">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedConfig ? "输入消息..." : "请先配置AI服务"}
          disabled={!selectedConfig || isLoading}
          rows={1}
          className="w-full resize-none bg-muted px-4 py-3 pr-12 text-sm disabled:opacity-50 outline-none border-0 focus:ring-0"
          style={{ maxHeight: "200px", overflowY: "auto" }}
        />
        <Button
          size="icon"
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || !selectedConfig || isLoading}
          className="absolute right-2 bottom-1.5 rounded-full h-8 w-8 flex items-center justify-center shadow-md"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 输入提示 */}
      <div className="text-xs text-muted-foreground mt-2 text-center">
        {selectedConfig ? (
          <>
            按 <kbd className="px-1 py-0.5 border rounded text-[10px]">Enter</kbd> 发送，
            <kbd className="px-1 py-0.5 border rounded text-[10px]">Shift</kbd> +{" "}
            <kbd className="px-1 py-0.5 border rounded text-[10px]">Enter</kbd> 换行 •
            当前使用: {selectedConfig.name} ({selectedConfig.model})
          </>
        ) : (
          "请先在设置中配置AI服务"
        )}
      </div>
    </div>
  );
}
