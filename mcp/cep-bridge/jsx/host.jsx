// AE MCP Bridge - host ExtendScript
// Loaded once by CEP when the panel is opened. Defines a function that is
// invoked ON DEMAND via CSInterface.evalScript() -- there is NO app.scheduleTask
// polling here, so After Effects never force-preempts a modal dialog.

function aemcp_runTask(code) {
  var evalResult = null;
  var errorMsg = null;
  try {
    // Function LITERAL via eval (not the Function() constructor - ExtendScript's
    // Function constructor has a known bug where `return` inside its body throws
    // "Illegal return outside of a function body"). This form gives `code` a real
    // function scope, so explicit `return <value>;` statements - the convention
    // every built-in tool script in tools.ts uses - work correctly.
    //
    // Caveat: a script with no explicit `return` (a bare trailing expression like
    // `"done";`) silently yields undefined here, since JS does not auto-return a
    // function body's last expression. Scripts run via ae_run_custom_script must
    // end with an explicit `return <value>;` to get a result back.
    evalResult = eval("(function() { " + code + " })()");
  } catch (err) {
    errorMsg = err.toString() + (err.line ? " (Linha " + err.line + ")" : "");
  }
  var response = {
    success: errorMsg === null,
    data: evalResult,
    error: errorMsg
  };
  try {
    return JSON.stringify(response);
  } catch (stringifyErr) {
    return JSON.stringify({ success: false, data: null, error: "Falha ao serializar resultado: " + stringifyErr.toString() });
  }
}
