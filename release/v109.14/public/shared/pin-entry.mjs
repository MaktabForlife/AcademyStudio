// Remember account IDs, never leave a credential in a reopened form. Keeping
// unopened PIN controls readonly also prevents automatic saved-password fill.
export function pinEntry(form){
 const fields=[form.elements.pin,form.elements.pinConfirmation].filter(Boolean);
 function clear(lock=true){for(const field of fields){field.value='';field.defaultValue='';field.readOnly=lock;}}
 for(const field of fields){
  field.setAttribute('autocomplete','off');field.setAttribute('data-lpignore','true');field.setAttribute('data-1p-ignore','true');
  const unlock=()=>{if(field.readOnly){field.value='';field.readOnly=false;}};
  field.addEventListener('pointerdown',unlock);
  field.addEventListener('keydown',event=>{if(!event.ctrlKey&&!event.metaKey&&(event.key?.length===1||['Backspace','Delete'].includes(event.key)))unlock();});
 }
 form.elements.uniqueid.addEventListener('input',()=>clear());
 form.elements.uniqueid.addEventListener('change',()=>clear());
 clear();
 return {clear,validate(){for(const field of fields)field.readOnly=false;return form.reportValidity();},take(){const value={pin:form.elements.pin.value,pinConfirmation:form.elements.pinConfirmation?.value||''};clear();return value;},focus(){clear(false);form.elements.pin.focus();}};
}
