import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function ReleaseNotesPage() {
  const [loading, setLoading] = useState(true);
  const releaseNotesUrl = "https://jiqingzhe2004.github.io/";

  return (
    <div className="absolute inset-0">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">正在加载...</p>
          </div>
        </div>
      )}
      <iframe
        src={releaseNotesUrl}
        onLoad={() => setLoading(false)}
        title="更新日志"
        className="w-full h-full border-0"
      />
    </div>
  );
} 