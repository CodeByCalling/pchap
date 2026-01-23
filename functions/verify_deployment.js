
async function testDeployedFunction() {
    const url = "https://us-central1-jrm-member-dng-portal.cloudfunctions.net/chatWithCounselor";
    console.log("Calling URL:", url);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    message: "Hello",
                    history: []
                }
            })
        });

        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text);

    } catch (error) {
        console.error("Error:", error);
    }
}

testDeployedFunction();
