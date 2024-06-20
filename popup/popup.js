let optimize = document.getElementById("optimize");
let addParameter = document.getElementById("addParameter");
let search = document.getElementById("search")
let params = document.getElementById("parameters")

let paramIndex = 0;

// This list have the parameters that will be shown in the dropdown
let inputElements = [];

// This list saves the selected parameters by the User
let selectedParameters = [];

chrome.storage.local.get(["selectedParameters", "inputElements"], function(result) {
  var userValue = null;
  if(result["selectedParameters"]) {
    selectedParameters = result["selectedParameters"];
  }

  if(result["inputElements"]) {
    inputElements = result["inputElements"]
  }

  if(selectedParameters && inputElements) {
    if(selectedParameters.length <= 0) {
      // There aren't any parameter saved, hence just show the default
    } else {
      // There are some parameters
      for(let i=0; i<selectedParameters.length; ++i) {
        addParameterBlock(i);
      }
      setDropDownOptions();
      setLastUserParameters(selectedParameters.length);
    }
  }
});

// Tab event listeners to change body width 
addTabEventListeners()

// Add Parameter Button Event Listener
addParameter.addEventListener("click", async () => {
  addParameterBlock()
});

// Add search event listener
search.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['readInjector.js']
  });
});

// Add start optimize event listener
optimize.addEventListener("click", async () => {
  console.log("SelectedParameters");
  console.log(selectedParameters)
  
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  var userInputs = []
  
  // err is handled as value
  // var err = CreateUserInputsMessage(userInputs)
  var err = new Error("")

  if (err.message == '') {
    chrome.storage.local.set({ "userInputs": selectedParameters });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['injector.js']
    });
  } else if(err.message === 'missing-parameters') {
    chrome.runtime.sendMessage({
      notify: {
        type: "warning",
        content: "Fill all parameter inputs accordingly & Use dot '.' decimal separator"
      }
    });
  }else if(err.message === 'wrong-parameter-values'){
    chrome.runtime.sendMessage({
      notify: {
        type: "warning",
        content: "'Start' value must be less than 'End' value"
      }
    });
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  var properties = Object.keys(message)
  var values = Object.values(message)
  // popupAction type defines popup html UI actions according to event type
  if (properties[0] === 'popupAction') {
    var popupAction = values[0]

    if (popupAction.event === 'lockOptimizeButton') {

      document.querySelector("#optimize").setAttribute("disabled", "")

    } else if (popupAction.event === 'unlockOptimizeButton') {

      document.querySelector("#optimize").removeAttribute("disabled", "")

    } else if (popupAction.event === 'fetchInputSuccess') {

      inputElements = popupAction.inputElements;
      
      chrome.storage.local.set({"inputElements" : inputElements});

      let selects = document.getElementsByTagName("select");
      for(var i=0; i<selects.length; i++) {
        for(var j=0; j<inputElements.length; j++) {
          var opt = inputElements[j].nameElement;
          var el = document.createElement("option");
          el.textContent = opt;
          el.value = opt;
          selects[i].appendChild(el);
        }
      }

    }
  }
});

// Create Reports Tab Table
createReportTable()

// Refresh Report Data Manually 
addRefreshDataEventListener()

//#region Report Tab & Table

async function createReportTable() {
  await sleep(200)

  chrome.storage.local.get(null, function (items) {
    var reportData = []

    if (items == null) {
      return
    }

    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith("report-data-")) {
        var date = new Date(value.created)
        var formattedDate = (date.getMonth()+1).toString() + '/' + date.getDate() + '/' + date.getFullYear() + ' ' + ("0" + date.getHours()).slice(-2) + ':' + ("0" + date.getMinutes()).slice(-2)
        var report = {
          "strategyID": value.strategyID,
          "strategyName": value.strategyName,
          "date": formattedDate,
          "symbol": value.symbol,
          "timePeriod": value.timePeriod,
          "parameters": value.parameters,
          "maxprofit": value.maxProfit,
          "detail": reportDetailHtml(value.strategyID)
        }
        reportData.push(report)
      }
    }
    var $table = $('#table')
    $table.bootstrapTable({data: reportData})
    $table.bootstrapTable('load', reportData)
  });

}

function reportDetailHtml(strategyID) {
  return '<button id="report-detail-button" strategy-id="' + strategyID + '" type="button" class="btn btn-primary btn-sm"><i class="bi bi-clipboard2-data-fill"> Open</i></button>\
  <button id="remove-report" type="button" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i></button>'
}

// Add Custom Styles to Columns 
function reportDetailButtonStyle(value, row, index) {
  return {
    css: {
      'text-align': 'center',
      'white-space': 'nowrap'
    }
  }
}

function maxProfitColumnStyle(value, row, index) {
  return {
    css: {
      'word-break': 'break-all'
    }
  }
}

function parametersColumnStyle(value, row, index) {
  return {
    css: {
      'word-break': 'break-word'
    }
  }
}

function symbolColumnStyle(value, row, index) {
  return {
    css: {
      'word-break': 'break-all'
    }
  }
}

function strategyNameColumnStyle(value, row, index) {
  return {
    css: {
      'word-break': 'break-word',
      'font-weight': '500'
    }
  }
}


window.openReportDetail = {
  // Set ReportDetail query string to build html report detail dynamically 
  'click #report-detail-button': function (e, value, row, index) {
    chrome.tabs.create({ url: 'report/reportdetail.html?strategyID=' + row.strategyID })

  },
  // Remove Report from both storage and table
  'click #remove-report': function (e, value, row, index) {
    var $table = $('#table')
    chrome.storage.local.remove(["report-data-" + row.strategyID])
    $table.bootstrapTable('remove', {
      field: 'strategyID',
      values: [row.strategyID]
    })
  }
}

//#endregion

function addParameterBlock(idx = -1) {
  var parameters = document.getElementById("parameters");
  var parameterCount = parameters.children.length;

  //Add Parameter Block
  if(idx === -1) {
    // if the index is -1, it means that we need to add a default block
    var orderOfParameter = parameterCount;
    var divToAppend = addParameterBlockHtml(orderOfParameter);
    parameters.insertAdjacentHTML('beforeend', divToAppend);
    
    // Add Remove Button Event Listener
    addRemoveParameterBlockEventListener(parameterCount)
  
    // Save Inputs EventListener for rest of the parameters
    addSaveInputEventListener(parameterCount)

    // Add options to selects
    addSelectOptions(orderOfParameter)
} else {
    // Add checking the type of the element
    if(selectedParameters.length > 0 && selectedParameters[idx].type === "numeric") {
      var orderOfParameter = idx;
      var divToAppend = addParameterBlockHtml(orderOfParameter);
      parameters.insertAdjacentHTML('beforeend', divToAppend);

      // Increment User's Last Parameter Count State    
      // chrome.storage.local.set({ "userParameterCount": parameterCount + 1 });
    
      // // Add Remove Button Event Listener
      // addRemoveParameterBlockEventListener(parameterCount)
    
      // // Save Inputs EventListener for rest of the parameters
      // addSaveInputEventListener(parameterCount)
    
      // // Add options to selects
      // addSelectOptions(orderOfParameter)
    } else {
      var orderOfParameter = idx;
      var divToAppend = addCheckboxMessageBlockHtml(orderOfParameter);
      parameters.insertAdjacentHTML('beforeend', divToAppend);

      // Increment User's Last Parameter Count State    
      // chrome.storage.local.set({ "userParameterCount": parameterCount + 1 });
    
      // // Add Remove Button Event Listener
      // addRemoveParameterBlockEventListener(parameterCount)
    
      // // Save Inputs EventListener for rest of the parameters
      // addSaveInputEventListener(parameterCount)
    
      // // Add options to selects
      // addSelectOptions(orderOfParameter)
    }
  }

  // Hide Last Remove Div for added parameters
  parameterCount = parameters.children.length;
  if (parameterCount > 1) {
    var removeDiv = "#remove" + (parameterCount-2) + "";
    document.querySelector(removeDiv).style = 'display:none;';
  }
}

function addParameterBlockHtml(orderOfParameter) {
  return '<div class="row g-2 pb-2">\
    <div class="col-3"> \
      <label for="selectParameter' + orderOfParameter + ' " class="form-label">' + orderOfParameter +'. Parameter</label> \
      <select id="selectParameter' + orderOfParameter + '" class="form-select" aria-label="Default select example"> \
        <option value="" selected disabled hidden>Select</option>\
      </select> \
    </div> \
    <div class="col-6" id="paramInputs">\
      <label for="inputStart" class="form-label">Parameter Inputs</label>\
      <div class="input-group input-group">\
        <input type="text" aria-label="Start" placeholder="Start" class="form-control" id="inputStart' + orderOfParameter + '">\
        <input type="text" aria-label="End" placeholder="End" class="form-control" id="inputEnd' + orderOfParameter + '">\
      </div>\
    </div>\
    <div class="col-3 mt-auto">\
      <div class="text-end" id="remove' + orderOfParameter + '">\
        <label for="close" class="form-label text-muted">Remove</label>\
        <button type="button" class="btn-close align-text-top remove-parameters" aria-label="Close"></button>\
      </div>\
      <input type="text" aria-label="Step" placeholder="Step" class="form-control"\
        id="inputStep' + orderOfParameter + '">\
    </div>\
  </div>'
}

function addCheckboxMessageBlockHtml(orderOfParameter) {
  return '<div class="row g-2 pb-2">\
    <div class="col-3"> \
      <label for="selectParameter' + orderOfParameter + ' " class="form-label">' + orderOfParameter +'. Parameter</label> \
      <select id="selectParameter' + orderOfParameter + '" class="form-select" aria-label="Default select example"> \
        <option value="" selected disabled hidden>Select</option>\
      </select> \
    </div> \
    <div class="col-3" id="paramInputs">\
      <label for="inputStart" class="form-label">Parameter Inputs</label>\
      <input class="form-control" type="text" placeholder="Checkbox field is selected" readonly disabled> \
    </div>\
    <div class="col-3 mt-auto">\
      <div class="text-end" id="remove' + orderOfParameter + '">\
        <label for="close" class="form-label text-muted">Remove</label>\
        <button type="button" class="btn-close align-text-top remove-parameters" aria-label="Close"></button>\
      </div>\
    </div>\
  </div>'
}

function addRemoveParameterBlockEventListener(parameterCount){
  document.querySelectorAll(".btn-close.remove-parameters")[parameterCount].addEventListener("click", async (evt) => {
    // Remove the selected row from incoming event 
    var evtPath = eventPath(evt)
    for (let i = 0; i < evtPath.length; i++) {
      const element = evtPath[i];
      if (element.className == "row g-2 pb-2") {
        element.remove()
        break;
      }
    }

    var parameters = document.getElementById("parameters")
    var parameterCount = parameters.children.length

    if(parameterCount > 0) {
      var removeDiv = "#remove" + (parameterCount-1) + "";
      parameters.lastElementChild.querySelector(removeDiv).style = 'display:block;'
    }

    selectedParameters.splice(parameterCount, 1);

  });
}

function addSelectOptions(parameterCount) {
  let element = document.getElementById("selectParameter"+parameterCount)
  for(var j=0; j<inputElements.length; j++) {
    var opt = inputElements[j].nameElement;
    var el = document.createElement("option");
    el.textContent = opt;
    el.value = opt;
    element.appendChild(el);
  }
}

// Retrieve and set select options from last saved state
function setDropDownOptions() {
  let selects = document.getElementsByTagName("select");
    for(var i=0; i<selects.length; i++) {
      for(var j=0; j<inputElements.length; j++) {
        var opt = inputElements[j].nameElement;
        var el = document.createElement("option");
        el.textContent = opt;
        el.value = opt;
        selects[i].appendChild(el);
      }
    }
}

// Retrieve and set user parameters from last saved state
function setLastUserParameters(parameterCount) {

  for (let i = 0; i < parameterCount; ++i) {
    let selectValue = selectedParameters[i].parameter;
    document.querySelectorAll("[id^='selectParameter']")[i].value = selectValue;

    // if(selectedParameters[i] && selectedParameters[i].type === "numeric") {
    //   chrome.storage.local.get(["inputStart" + i], function (result) {
    //     var userValue = null
    //     if (result["inputStart" + i]) {
    //       userValue = result["inputStart" + i]
    //     }
    //     document.querySelectorAll("#inputStart")[i].value = userValue
    //   });
  
    //   chrome.storage.local.get(["inputEnd" + i], function (result) {
    //     var userValue = null
    //     if (result["inputEnd" + i]) {
    //       userValue = result["inputEnd" + i]
    //     }
    //     document.querySelectorAll("#inputEnd")[i].value = userValue
    //   });
  
    //   chrome.storage.local.get(["inputStep" + i], function (result) {
    //     var userValue = null
    //     if (result["inputStep" + i]) {
    //       userValue = result["inputStep" + i]
    //     }
    //     document.querySelectorAll("#inputStep")[i].value = userValue
    //   });
    // }
  }
}

// Save last user inputs to storage as state
function addSaveInputEventListener(parameterCount) {
  document.querySelector("#selectParameter" + parameterCount + "").addEventListener("blur", function(e) {
    var param = "selectParameter" + parameterCount
    var value = document.querySelectorAll("[id^='selectParameter']")[parameterCount].value
    chrome.storage.local.set({ [param]: value })
  });

  document.querySelector("#inputStart" + parameterCount + "").addEventListener("blur", function(e) {
    var value = document.querySelector("#inputStart" + parameterCount + "").value;
    selectedParameters[parameterCount].start = value;
    chrome.storage.local.set({["selectedParameters"]: selectedParameters });
  });

  document.querySelector("#inputEnd" + parameterCount + "").addEventListener("blur", function (e) {
    var value = document.querySelector("#inputEnd" + parameterCount + "").value;
    selectedParameters[parameterCount].end = value;
    chrome.storage.local.set({["selectedParameters"]: selectedParameters });
  });

  document.querySelector("#inputStep" + parameterCount + "").addEventListener("blur", function (e) {
    var value = document.querySelector("#inputStep" + parameterCount + "").value;
    selectedParameters[parameterCount].step = value;
    chrome.storage.local.set({["selectedParameters"]: selectedParameters });
  });
}
// Dynamically change html body size 
function addTabEventListeners() {
  document.querySelector("#reports-tab").addEventListener("click", function () {
    document.body.style.width = '720px'
  })

  document.querySelector("#home-tab").addEventListener("click", function () {
    document.body.style.width = '560px'
  })
}
// Refresh table data with refresh button
function addRefreshDataEventListener() {
  document.querySelector("#refresh").addEventListener("click", function () {
    createReportTable()
  })
}

params.addEventListener("change", function(event) {
  if(event.target.classList.contains("form-select")) {
    let str = event.target.id;
    let idx = parseInt(str.replace("selectParameter", ""));
    index = inputElements[event.target.selectedIndex-1].index
    type = inputElements[event.target.selectedIndex-1].type

    selectedParameters[idx] = {parameter: event.target.value, index: index, type: type};
    chrome.storage.local.set({ ["selectedParameters"]: selectedParameters });

    if(type === "boolean") {
      // Change the display elements of this select
      parent = document.querySelectorAll("#paramInputs")[idx];
      root = parent.parentNode;
      firstChildToRemove = parent.children[1];
      SecondChildToRemove = root.children[2];
      parent.removeChild(firstChildToRemove)
      root.removeChild(SecondChildToRemove)
      parent.insertAdjacentHTML('beforeend', addCheckBoxMessageHTML());
      root.insertAdjacentHTML('beforeend', addRemoveButtonHTML(idx))
      
      // If it isn't that last element, hide the remove value
      parameterCount = parameters.children.length;
      if(idx < parameterCount-1) {
        var removeDiv = "#remove" + (idx) + "";
        document.querySelector(removeDiv).style = 'display:none;';
      }

      // Add corresponding event to the remove button
      addRemoveParameterBlockEventListener(idx)
    } else {
      parent = document.querySelectorAll("#paramInputs")[idx];
      root = parent.parentNode;
      firstChildToRemove = parent.children[1];
      secondChildToRemove = root.children[2];
      parent.removeChild(firstChildToRemove)
      root.removeChild(secondChildToRemove)
      parent.insertAdjacentHTML('beforeend', addNumericInputsHTML(idx));
      root.insertAdjacentHTML('beforeend', addStepInputHTML(idx))

      // If it isn't that last element, hide the remove value
      parameterCount = parameters.children.length;
      if(idx < parameterCount-1) {
        var removeDiv = "#remove" + (idx) + "";
        document.querySelector(removeDiv).style = 'display:none;';
      }

      // Add corresponding event to the remove button
      addRemoveParameterBlockEventListener(idx)

       // Save Inputs EventListener for rest of the parameters
      addSaveInputEventListener(idx)
    }
  }

});

function addCheckBoxMessageHTML() {
  return '<input class="form-control" type="text" placeholder="Checkbox field is selected" readonly disabled>'
}

function addRemoveButtonHTML(orderOfParameter) {
  return '<div class="col-3 mt-auto">\
            <div class="text-end" id="remove' + orderOfParameter + '">\
              <label for="close" class="form-label text-muted">Remove</label>\
              <button type="button" class="btn-close align-text-top remove-parameters" aria-label="Close"></button>\
            </div>\
          </div>';
}

function addNumericInputsHTML(orderOfParameter) {
  return '<div class="input-group input-group">\
            <input type="text" aria-label="Start" placeholder="Start" class="form-control" id="inputStart' + orderOfParameter + '">\
            <input type="text" aria-label="End" placeholder="End" class="form-control" id="inputEnd' + orderOfParameter + '">\
          </div>'
}

function addStepInputHTML(orderOfParameter) {
  return '<div class="col-3 mt-auto">\
          <div class="text-end" id="remove' + orderOfParameter + '">\
            <label for="close" class="form-label text-muted">Remove</label>\
            <button type="button" class="btn-close align-text-top remove-parameters" aria-label="Close"></button>\
          </div>\
          <input type="text" aria-label="Step" placeholder="Step" class="form-control"\
            id="inputStep' + orderOfParameter + '">\
        </div>';
}

// Create user inputs message, return err.message if validation fails 
function CreateUserInputsMessage(userInputs) {
  var err = new Error("")
  var parameters = document.getElementById("parameters")

  var parameterCount = parameters.children.length

  for (let i = 0; i < parameterCount; i++) {
    var inputStart = parameters.children[i].querySelector("#inputStart").value
    var inputEnd = parameters.children[i].querySelector("#inputEnd").value
    var inputStep = parameters.children[i].querySelector("#inputStep").value
    
    if(!isNumeric(inputStart) || !isNumeric(inputEnd) || !isNumeric(inputStep)){
      err.message = "missing-parameters"
      return err
    }
    
    var start = parseFloat(inputStart)
    var end = parseFloat(inputEnd)
    var step = parseFloat(inputStep)
    
    if(start >= end || step <= 0){
      err.message = "wrong-parameter-values"
      return err
    }
    
    // userInputs.push({ parameter: selectedParameters[i].parameter, index: selectedParameters[i].index, type: selectedParameters[i].type, start: inputStart, end: inputEnd, stepSize: inputStep })
  }
  return err
}

//#region Helpers 

function isNumeric(str) {
  if (typeof str != "string"){
    return false 
  } 
  return !isNaN(str) && 
    !isNaN(parseFloat(str)) 
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dateSorter(a, b) {
  var aa = new Date(a)
  var bb = new Date(b)
  return aa - bb
}

// Reference: https://stackoverflow.com/questions/39245488/event-path-is-undefined-running-in-firefox
function eventPath(evt) {
  var path = (evt.composedPath && evt.composedPath()) || evt.path,
      target = evt.target;

  if (path != null) {
      // Safari doesn't include Window, but it should.
      return (path.indexOf(window) < 0) ? path.concat(window) : path;
  }

  if (target === window) {
      return [window];
  }

  function getParents(node, memo) {
      memo = memo || [];
      var parentNode = node.parentNode;

      if (!parentNode) {
          return memo;
      }
      else {
          return getParents(parentNode, memo.concat(parentNode));
      }
  }

  return [target].concat(getParents(target), window);
}

//#endregion