// Temporary script to trigger the cron report generation API and output the result.
// Run this script using: node prisma/test-cron.js

const main = async () => {
  console.log("Connecting to local server and triggering cron report generation...");
  try {
    const response = await fetch("http://localhost:3000/api/cron/generate-report");
    if (!response.ok) {
      const text = await response.text();
      console.error(`Error: Server responded with status ${response.status}`);
      console.error(text);
      return;
    }
    const result = await response.json();
    console.log("\n--- Cron Execution Result ---");
    console.log(JSON.stringify(result, null, 2));
    console.log("------------------------------\n");
    
    if (result.success) {
      console.log("Success! You can test/view the generated PDF at the URL below:");
      console.log(result.fileUrl);
    } else {
      console.log("Failed to generate report.");
    }
  } catch (err) {
    console.error("Error triggering cron route:", err.message);
    console.log("Make sure your Next.js development server is running on http://localhost:3000.");
  }
};

main();
