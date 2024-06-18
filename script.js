function getJSPath(element) {
    let path = [];

    // Traverse up the DOM tree
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        // Get the index of the element among its siblings with the same tag name
        let siblingIndex = Array.prototype.indexOf.call(element.parentNode.children, element) + 1;
        // Get the tag name of the element
        let tagName = element.tagName.toLowerCase();
        // Construct the part of the path
        let part = `${tagName}:nth-child(${siblingIndex})`;
        // Add to the path array
        path.unshift(part);
        // Move to the parent element
        element = element.parentNode;
    }

    // Join the parts of the path with ' > ' to form the final path
    return path.join(' > ');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function for generating combinations 
function generateCombinations(userInputs) { 
    const combinations = [];
    const currentCombination = [];

    function recurse(index) {
        if (index === userInputs.length) {
            combinations.push([...currentCombination]);
            return;
        }

        const input = userInputs[index];
        const start = parseFloat(input.start);
        const end = parseFloat(input.end);
        const stepSize = parseFloat(input.stepSize);

        for (let value = start; value <= end; value += stepSize){
            currentCombination[index] = value;
            recurse(index + 1);
        }   
    }

    recurse(0);
        return combinations;
}

// Extract the numerical net profit value
function getNetProfit() {
    const netProfitElement = document.querySelector("div[class*='negativeValue-'], div[class*='positiveValue-']");
    
    if (netProfitElement) {
        const profitText = netProfitElement.innerText;
        const profitValue = parseFloat(profitText.replace(/[^0-9.-]+/g, ""));
        return profitValue;
    } else {
        console.log('Net profit element not found');
        return null;
    }
}

// Optimization function 
async function OptimizeParams(userInputs, combination) {
    for (let i = 0; i < userInputs.length; i++) {
        const index = userInputs[i].index;
        const jsPath = jsPaths[index];
        const inputElement = document.querySelector(jsPath);

        if (inputElement) {
            // Hover over the input element to make the arrows visible
            tvInputs[index].dispatchEvent(new MouseEvent('mouseover', { 'bubbles': true }));

            inputElement.value = combination[i];
            inputElement.setAttribute('value', combination[i]);

            inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            inputElement.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

            console.log(`Set value for ${userInputs[i].parameter} to ${combination[i]}`);
            console.log(`Value: ${inputElement.value}`);

            await sleep(500);

            // Click the increase button 
            const increaseButton = document.querySelectorAll("button[class*=controlIncrease]")[0];
            if (increaseButton) {
                increaseButton.click();
                console.log('Clicked increase button');
                await sleep(500);
            } else {
                console.log('Increase button not found');
            }

            // Click the decrease button to return to the original value
            const decreaseButton = document.querySelectorAll("button[class*=controlDecrease]")[0];
            if (decreaseButton) {
                decreaseButton.click();
                console.log('Clicked decrease button');
                await sleep(500);
            } else {
                console.log('Decrease button not found');
            }

            // Verify the modified value is correct
            const currentValue = parseFloat(inputElement.value);
            if (currentValue !== combination[i]) {
                console.log(`Error: Expected value ${combination[i]}, but got ${currentValue}`);
            }

        } else {
            console.log(`Input element for ${userInputs[i].parameter} not found`);
        }
    }

    await sleep(1000);

    const netProfit = getNetProfit();
    return netProfit;
}

async function Process() {
    let maxProfit = -999999;
    let bestCombination = null;

    var userInputs = []

    // Construct UserInputs with Callback
    var userInputsEventCallback = function (evt) {
        window.removeEventListener("UserInputsEvent", userInputsEventCallback, false)
        userInputs = evt.detail
    }

    window.addEventListener("UserInputsEvent", userInputsEventCallback, false);

    // Wait for UserInputsEvent Callback
    await sleep(750)

    console.log("Callback:", userInputsEventCallback)
    console.log("UserInputs:", userInputs)

    var optimizationResults = new Map();

    // Generate combinations using the new function 
    var combinations  = generateCombinations(userInputs);
    console.log("Combinations:", combinations)

    for (const combination of combinations) {
        // Use the combination to optimize parameters
        const profit = await OptimizeParams(userInputs, combination)
        if (profit !== null && profit > maxProfit) {
            maxProfit = profit;
            bestCombination = combination;
        }

        console.log(`Combination: ${combination}, Profit: ${profit}`);
    }

    console.log(`Max Profit: ${maxProfit}`);
    console.log(`Best Combination: ${bestCombination}`);
}

// Run Optimization Process
var tvInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[inputmode='numeric']");
var jsPaths = Array.from(tvInputs).map(element => getJSPath(element));

Process()