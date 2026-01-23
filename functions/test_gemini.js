const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const apiKey = "AIzaSyAqVqPu9Yw_9u95zhJIkRw2NX4H6mZSAtM";
    console.log("Testing API Key:", apiKey);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using a model confirmed to exist in the curl output
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        const text = response.text();
        console.log("SUCCESS! Response:", text);
    } catch (error) {
        console.error("FAILURE! Error details:");
        console.error(error);
    }
}

testGemini();
