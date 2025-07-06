import React from 'react';

const ReleaseNotesPage = () => {
  const releaseNotesUrl = "https://jiqingzhe2004.github.io/"; // 您可以在这里替换成您的更新日志网址

  return (
    <div className="absolute inset-0">
      <iframe
        src={releaseNotesUrl}
        title="更新日志"
        className="w-full h-full border-0"
      />
    </div>
  );
};

export default ReleaseNotesPage; 