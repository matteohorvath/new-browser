"use client";
import { useState, useEffect } from "react";

function App() {
  const [urlParam, setUrlParam] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const _url = searchParams.get("_url");
    setUrlParam(_url);
  }, []);

  useEffect(() => {
    if (urlParam) {
      const downloadUrl = async () => {
        setDownloadStatus("Downloading...");
        try {
          const response = await fetch(
            `/api/download?url=${encodeURIComponent(urlParam)}`
          );
          const data = await response.json();

          if (!response.ok) {
            console.error("API Error:", data.error, data.details);
            setPageContent(null);
            setDownloadStatus(`Error: ${data.error || response.statusText}`);
          } else {
            console.log("API Response:", data);
            if (data.content) {
              setPageContent(data.content);
              setDownloadStatus("Success: Page loaded.");
            } else {
              setPageContent(null);
              setDownloadStatus(
                "Success: Received response but no content found."
              );
            }
          }
        } catch (error) {
          console.error("Fetch error:", error);
          setPageContent(null);
          setDownloadStatus("Error: Failed to contact API.");
        }
      };
      downloadUrl();
    } else {
      setDownloadStatus(null);
    }
  }, [urlParam]);

  return (
    <>
      {urlParam && <p>The value of &apos;_url&apos; is: {urlParam}</p>}
      {downloadStatus && <p>Download Status: {downloadStatus}</p>}
      {pageContent && (
        <iframe
          srcDoc={pageContent}
          style={{ width: "100%", height: "80vh", border: "1px solid #ccc" }}
          title="Crawled Page Content"
          sandbox="allow-same-origin allow-scripts"
        />
      )}
    </>
  );
}

export default App;
