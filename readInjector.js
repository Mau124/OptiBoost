console.log('Calling readInjector.js');
var isInjected = InjectScriptIntoDOM()

//Inject script into DOM to get access to React Props
function InjectScriptIntoDOM() {
    //Is TradingView Strategy Settings window opened validation
    if (document.querySelectorAll("div[data-name=indicator-properties-dialog]").length < 1) {
      return false;
    }

    let numericInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[inputmode='numeric']");
    let booleanInputs = document.querySelectorAll("div[data-name='indicator-properties-dialog'] input[type='checkbox']");

    const inputElements = []

    console.log("Printing numericInputs")
    let i = 0;
    for(const value of numericInputs.values()) {
      text = value.closest("div[class*=\"cell\"]").previousElementSibling.children.item(0).textContent
      inputElements.push({nameElement: text, index: i, type: "numeric"})
      console.log(typeof value.outerHTML);
      i+=1;
    }

    console.log("Printing booleanInputs")
    i = 0;
    for(const value of booleanInputs.values()) {
      text = value.closest("div[class*=\"fill\"]").children.item(0).children.item(0).children.item(1).textContent
      inputElements.push({nameElement: text, index: i, type: "boolean"})
      console.log(text);
      i+=1;
    }

    chrome.runtime.sendMessage({
      popupAction: {
        event: "fetchInputSuccess",
        inputElements: inputElements
      }
    });
    
    // console.log("Numberic Inputs");
    // console.log(numericInputs);
    // console.log("Items");
    // numericInputs.forEach((item) => {
    //     console.log(item);
    // })
    
    return true;
}