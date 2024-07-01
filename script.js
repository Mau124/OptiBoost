function getJSPath(element) {
    let path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let siblingIndex = Array.prototype.indexOf.call(element.parentNode.children, element) + 1;
        let tagName = element.tagName.toLowerCase();
        let part = `${tagName}:nth-child(${siblingIndex})`;
        path.unshift(part);
        element = element.parentNode;
    }
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
        const step = parseFloat(input.step);

        for (let value = start; value <= end; value += step){
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
        const profitText = netProfitElement.innerText.trim();
        const isNegative = netProfitElement.classList.contains('negativeValue-Yvm0jjs7');
        const isPositive = netProfitElement.classList.contains('positiveValue-Yvm0jjs7');
        const profitMatch = profitText.match(/(-?\d+(\.\d+)?)/);

        if (profitMatch) {
            let profitValue = parseFloat(profitMatch[0]);
            if (isNegative) {
                profitValue = -Math.abs(profitValue);
            } else if (isPositive) {
                profitValue = Math.abs(profitValue);
            }
            console.log(`Net profit value extracted: ${profitValue}`);
            return profitValue;
        } else {
            console.log('Failed to extract net profit value');
            return null;
        }
    } else {
        console.log('Net profit element not found');
        return null;
    }
}

// Function to generate and dispatch the report
function generateAndDispatchReport(optimizationResults, userInputs, maxProfit, bestCombination) {
    // Capture strategy information
    var strategyName = document.querySelector("div[class*=strategyGroup]")?.innerText || "Unknown Strategy";
    var strategyTimePeriod = "";
    var timePeriodGroup = document.querySelectorAll("div[class*=innerWrap] div[class*=group]");
    
    if (timePeriodGroup.length > 1) {
        var selectedPeriod = timePeriodGroup[1].querySelector("button[aria-checked*=true]");
        if (selectedPeriod != null) {
            strategyTimePeriod = selectedPeriod.querySelector("div[class*=value]")?.innerHTML || "Unknown Period";
        } else {
            strategyTimePeriod = timePeriodGroup[1].querySelector("div[class*=value]")?.innerHTML || "Unknown Period";
        }
    }

    var title = document.querySelector("title")?.innerText || "Unknown Title";
    var strategySymbol = title.split(' ')[0] || "Unknown Symbol";
    var optimizationResultsObject = Object.fromEntries(optimizationResults);
    var userInputsToString = userInputs.map(element => `${element.start}→${element.end}`).join(" ");

    var reportDataMessage = {
        "strategyID": Date.now(),
        "created": new Date().toISOString(),
        "strategyName": strategyName,
        "symbol": strategySymbol,
        "timePeriod": strategyTimePeriod,
        "parameters": userInputsToString,
        "maxProfit": maxProfit,
        "bestCombination": bestCombination,
        "reportData": optimizationResultsObject
    };

    // Dispatch the report
    var evt = new CustomEvent("ReportDataEvent", { detail: reportDataMessage });
    window.dispatchEvent(evt);
}

// Optimization function 
async function OptimizeParams(userInputs, combination) {
    for (let i = 0; i < userInputs.length; i++) {
        const index = userInputs[i].index;
        const jsPath = jsPaths[index];
        const inputElement = document.querySelector(jsPath);
        
        console.log(inputElement);

        if (inputElement) {
            // Hover over the input element to make the arrows visible
            tvInputs[index].dispatchEvent(new MouseEvent('mouseover', { 'bubbles': true }));
            await sleep(100);

            let currentValue = parseFloat(inputElement.value);
            const targetValue = combination[i];
            const isIncrease = targetValue > currentValue;
            const buttonSelector = isIncrease ? "button[class*=controlIncrease]" : "button[class*=controlDecrease]";
            const button = tvInputs[index].closest('[data-name="indicator-properties-dialog"]').querySelector(buttonSelector);

            if (button) {
                while ((isIncrease && currentValue < targetValue) || (!isIncrease && currentValue > targetValue)) {
                    button.click();
                    await sleep(500);

                    //Re-fetch the input value to ensure the latest value is read
                    currentValue = parseFloat(document.querySelector(jsPath).value);
                    if ((isIncrease && currentValue >= targetValue) || (!isIncrease && currentValue <= targetValue)) {
                        break;
                    }
                }
                // Verify if the modified value is correct
                if (currentValue !== targetValue) {
                    console.log(`Error: Expected value ${targetValue}, but got ${currentValue}`);
                }
                tvInputs[index].dispatchEvent(new MouseEvent('mouseout',  { 'bubbles': true }))
                await sleep(100);
            } else {
                console.log(`${isIncrease ? 'Increase' : 'Decrease'} button not found`);
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

    //console.log("Callback:", userInputsEventCallback)
    //console.log("UserInputs:", userInputs)

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

        optimizationResults.set(combination, profit);

        console.log(`Combination: ${combination}, Profit: ${profit}`);
    }

    generateAndDispatchReport(optimizationResults, userInputs, maxProfit, bestCombination)
    console.log(`Max Profit: ${maxProfit}`);
    console.log(`Best Combination: ${bestCombination}`);
}

// Run Optimization Process
var tvInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[inputmode='numeric']");
var jsPaths = Array.from(tvInputs).map(element => getJSPath(element));

Process()