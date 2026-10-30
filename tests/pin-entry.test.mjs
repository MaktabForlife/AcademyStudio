import test from 'node:test';import assert from 'node:assert/strict';import {pinEntry} from '../public/shared/pin-entry.mjs';
function field(value=''){return Object.assign(new EventTarget(),{value,defaultValue:value,readOnly:false,attributes:new Map(),setAttribute(k,v){this.attributes.set(k,v);},focus(){this.focused=true;}});}
test('opening, changing account and submitting clear both PIN controls including browser-restored defaults',()=>{
 const form={reportValidity:()=>false,elements:{uniqueid:field('FIRST'),pin:field('1234'),pinConfirmation:field('1234')}},entry=pinEntry(form),pin=form.elements.pin;
 assert.equal(pin.value,'');assert.equal(pin.defaultValue,'');assert.equal(pin.readOnly,true);assert.equal(pin.attributes.get('autocomplete'),'off');
 pin.dispatchEvent(new Event('pointerdown'));assert.equal(pin.readOnly,false);pin.value='1234';form.elements.pinConfirmation.value='1234';
 assert.deepEqual(entry.take(),{pin:'1234',pinConfirmation:'1234'});assert.equal(pin.value,'');assert.equal(form.elements.pinConfirmation.value,'');assert.equal(pin.readOnly,true);
 pin.value='restored';pin.defaultValue='restored';form.elements.uniqueid.dispatchEvent(new Event('input'));assert.equal(pin.value,'');assert.equal(pin.defaultValue,'');
 assert.equal(entry.validate(),false,'The empty required PIN must be checked after unlocking');entry.focus();assert.equal(pin.readOnly,false);assert.equal(pin.focused,true);pin.value='1234';entry.clear();assert.equal(pin.value,'');
 const key=new Event('keydown');Object.defineProperty(key,'key',{value:'1'});pin.dispatchEvent(key);assert.equal(pin.readOnly,false,'Keyboard entry must unlock before the first digit is inserted');
});
