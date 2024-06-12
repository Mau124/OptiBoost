// Select all input values
var tvInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[inputmode='numeric']")
var numericInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[inputmode='numeric']")
var booleanInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[type='checkbox']")
var maxProfit = -99999

// Run Optimization Process 
Process();

async function Process() {
    var userInputs = [];

    // Construct UserInputs with callback
    var userInputsEventCallback = function (evt) {
        window.removeEventListener("UserInputsEvent", userInputsEventCallback, false);
        userInputs = evt.detail;
    };

    window.addEventListener("UserInputsEvent", userInputsEventCallback, false);

    // Wait for UserInputsEvent Callback
    await sleep(750);

    var optimizationResults = new Map();

    await SetUserIntervals(userInputs, optimizationResults);

    // Generate parameter ranges
    var ranges = userInputs.map(element => {
        if (element.type === 'boolean') {
            return [true, false];
        } else {
            return Array.from({ length: Math.round((element.end - element.start) / element.stepSize) + 1 }, (_, i) => element.start + i * element.stepSize);
        }
    });

    // Generate all combinations of parameter values
    var combinations = cartesianProduct(ranges);

    for (let combo of combinations) {
        for (let i = 0; i < combo.length; i++) {
            if (typeof combo[i] === 'boolean') {
                SetBooleanTvInput(tvInputs[i], combo[i]);
            } else {
                ChangeTvInput(tvInputs[i], combo[i]);
            }
        }
        await OptimizeParams(userInputs, 0, optimizationResults);
    }

    // Add ID, StrategyName, Parameters and MaxProfit to Report Message
    var strategyName = document.querySelector("div[class*=strategyGroup]")?.innerText;
    var strategyTimePeriod = "";

    var timePeriodGroup = document.querySelectorAll("div[class*=innerWrap] div[class*=group]");
    if (timePeriodGroup.length > 1) {
        var selectedPeriod = timePeriodGroup[1].querySelector("button[aria-checked*=true]");

        // Check if favorite time periods exist  
        if (selectedPeriod != null) {
            strategyTimePeriod = selectedPeriod.querySelector("div[class*=value]")?.innerHTML;
        } else {
            strategyTimePeriod = timePeriodGroup[1].querySelector("div[class*=value]")?.innerHTML;
        }
    }

    var title = document.querySelector("title")?.innerText;
    var strategySymbol = title.split(' ')[0];
    var optimizationResultsObject = Object.fromEntries(optimizationResults);
    var userInputsToString = userInputs.map((element, index) => `${element.start}→${element.end}`).join(' ');

    var reportDataMessage = {
        "strategyID": Date.now(),
        "created": Date.now(),
        "strategyName": strategyName,
        "symbol": strategySymbol,
        "timePeriod": strategyTimePeriod,
        "parameters": userInputsToString,
        "maxProfit": maxProfit,
        "reportData": optimizationResultsObject
    };
    // Send Optimization Report to injector
    var evt = new CustomEvent("ReportDataEvent", { detail: reportDataMessage });
    window.dispatchEvent(evt);
}

// Generate all combinations of parameter values
function cartesianProduct(arr) {
    return arr.reduce((a, b) => a.flatMap(d => b.map(e => [d].flat().concat(e))), [[]]);
}

// Set User Given Intervals Before Optimization Starts
async function SetUserIntervals(userInputs, optimizationResults) {
    console.log("SetUserIntervals")
    console.log(userInputs)
    console.log(tvInputs)
    console.log(optimizationResults)
    for (let i = 0; i < userInputs.length; i++) {
        await sleep(1000);
        var currentParameter = tvInputs[i].value;
        var num = userInputs[i].start - userInputs[i].stepSize;

        if (userInputs[i].type === 'boolean') {
            SetBooleanTvInput(tvInputs[i], false);
        } else {
            ChangeTvInput(tvInputs[i], Math.round(num * 100) / 100);
        }

        if (currentParameter == userInputs[i].start) {
            await IncrementParameter(i);
        } else {
            await OptimizeParams(userInputs, i, optimizationResults);
        }

        await sleep(1000);
    }
    // TO-DO: Inform user about Parameter Intervals are set and optimization starting now.
}

// Optimize strategy for given tvParameterIndex, increment parameter and observe mutation 
async function OptimizeParams(userInputs, tvParameterIndex, optimizationResults) {
    console.log('OptimizeParams')
    console.log(userInputs)
    const reportData = new Object({
        netProfit: {
            amount: 0,
            percent: ""
        },
        closedTrades: 0,
        percentProfitable: "",
        profitFactor: 0.0,
        maxDrawdown: {
            amount: 0,
            percent: ""
        },
        averageTrade: {
            amount: 0,
            percent: ""
        },
        avgerageBarsInTrades: 0
    });

    setTimeout(() => {
        // Hover on Input Arrows  
        tvInputs[tvParameterIndex].dispatchEvent(new MouseEvent('mouseover', { 'bubbles': true }));
    }, 250);

    setTimeout(() => {
        // Click on Upper Input Arrow
        document.querySelectorAll("button[class*=controlIncrease]")[tvParameterIndex].click();
    }, 750);

    // Observe mutation for new Test results, validate it and save it to optimizationResults Map
    const p1 = new Promise((resolve, reject) => {
        var observer = new MutationObserver(function (mutations) {
            mutations.every(function (mutation) {
                if (mutation.type === 'characterData') {
                    if (mutation.oldValue != mutation.target.data) {
                        var params = GetParametersFromWindow(userInputs);

                        if (!optimizationResults.has(params) && params != "ParameterOutOfRange") {
                            ReportBuilder(reportData, mutation);
                            optimizationResults.set(params, reportData);
                            // Update Max Profit
                            var replacedNDashProfit = reportData.netProfit.amount.replace("−", "-");
                            var profit = Number(replacedNDashProfit.replace(/[^0-9-\.]+/g, ""));
                            if (profit > maxProfit) {
                                maxProfit = profit;
                            }
                            resolve("Optimization param added to map: " + params + " Profit: " + optimizationResults.get(params).netProfit.amount);
                        } else if (optimizationResults.has(params)) {
                            resolve("Optimization param already exist " + params);
                        } else {
                            resolve("Parameter is out of range, omitted");
                        }
                        observer.disconnect();
                        return false;
                    }
                }
                return true;
            });
        });

        var element = document.querySelector("div[class*=backtesting][class*=deep-history]");
        let options = {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true,
            attributes: true,
            attributeOldValue: true
        };
        observer.observe(element, options);
    });

    const p2 = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject("Timeout exceed");
        }, 10 * 1000);
    });

    await sleep(1000);
    // Promise race the observation with 10 sec timeout in case of Strategy Test Overview window fails to load
    await Promise.race([p1, p2])
        .then()
        .catch(reason => console.log(`Rejected: ${reason}`));
}

// Change TvInput value in Tv Strategy Options Window
function ChangeTvInput(input, value) {
    const event = new Event('input', { bubbles: true });
    const previousValue = input.value;

    input.value = value;
    input._valueTracker.setValue(previousValue);
    input.dispatchEvent(event);
}

// Set boolean TvInput value in Tv Strategy Options Window
function SetBooleanTvInput(input, value) {
    const currentState = input.getAttribute('aria-checked') === 'true';
    if (currentState !== value) {
        input.click();
    }
}

// Increment Parameter without observing the mutation
function IncrementParameter(tvParameterIndex) {
    // Hover on Input Arrows  
    tvInputs[tvParameterIndex].dispatchEvent(new MouseEvent('mouseover', { 'bubbles': true }));

    // Click on Upper Input Arrow
    return new Promise((resolve) => {
        setTimeout(() => {
            document.querySelectorAll("button[class*=controlIncrease]")[tvParameterIndex].click();
            resolve("");
        }, 500);
    });
}

// Get Currently active parameters from Tv Strategy Options Window and format them
function GetParametersFromWindow(userInputs) {
    var parameters = "";

    for (let i = 0; i < userInputs.length; i++) {
        if (userInputs[i].start > parseFloat(tvInputs[i].value) || parseFloat(tvInputs[i].value) > userInputs[i].end) {
            parameters = "ParameterOutOfRange";
            break;
        }

        if (i == userInputs.length - 1) {
            parameters += tvInputs[i].value;
        } else {
            parameters += tvInputs[i].value + ", ";
        }
    }
    return parameters;
}

// Build Report data from performance overview
function ReportBuilder(reportData, mutation) {
    var reportDataSelector = mutation.target.ownerDocument.querySelectorAll("[class^='secondRow']");

    // 1. Column
    reportData.netProfit.amount = reportDataSelector[0].querySelectorAll("div")[0].innerText;
    reportData.netProfit.percent = reportDataSelector[0].querySelectorAll("div")[1].innerText;
    // 2. 
    reportData.closedTrades = reportDataSelector[1].querySelector("div").innerText;
    // 3.
    reportData.percentProfitable = reportDataSelector[2].querySelector("div").innerText;
    // 4.
    reportData.profitFactor = reportDataSelector[3].querySelector("div").innerText;
    // 5.
    reportData.maxDrawdown.amount = reportDataSelector[4].querySelectorAll("div")[0].innerText;
    reportData.maxDrawdown.percent = reportDataSelector[4].querySelectorAll("div")[1].innerText;
    //6.
    reportData.averageTrade.amount = reportDataSelector[5].querySelectorAll("div")[0].innerText;
    reportData.averageTrade.percent = reportDataSelector[5].querySelectorAll("div")[1].innerText;

    reportData.averageBarsInTrades = reportDataSelector[6].querySelector("div").innerText;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

//Mutation Observer Code for console debugging purposes
/*
        var observer = new MutationObserver(function (mutations) {
            mutations.every(function (mutation) {
                if (mutation.type === 'characterData') {
                    if(mutation.oldValue != mutation.target.data){
                        console.log(mutation)
                        observer.disconnect()
                        return false
                    }
                }
                return true
            });
        });

        var element = document.querySelector(".backtesting-content-wrapper.widgetContainer-Lo3sdooi")
        let options = {
            attributes: false,
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true,
            attributes: true,
            attributeOldValue: true
        }
        observer.observe(element, options);
*/