import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
import {dashboardWorkspace,dashboardHomeHref,readDashboardView,rememberDashboardView,clearDashboardView} from '../public/shared/dashboard-home.mjs';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};};
test('dashboard mode is an account-bound per-tab hint, with no identity or authority from storage',()=>{
 const storage=memory();rememberDashboardView(storage,'account-a','learn');
 assert.equal(readDashboardView(storage,undefined),null);assert.equal(readDashboardView(storage,'account-b'),null);assert.equal(readDashboardView(storage,'account-a'),'learn');
 assert.equal(dashboardWorkspace('superadmin'),null);assert.equal(dashboardHomeHref('learn'),'/?dashboard=1&workspace=learn');assert.equal(dashboardHomeHref('https://evil.test'),'/?dashboard=1');
 rememberDashboardView(storage,'account-a','https://evil.test');assert.equal(readDashboardView(storage,'account-a'),'learn');
 clearDashboardView(storage);assert.equal(readDashboardView(storage,'account-a'),null);
 for(const raw of ['{','[]','{"accountId":"account-a","mode":"owner"}','x'.repeat(1025)]){storage.setItem('m4l_circles_dashboard_view_v1',raw);assert.equal(readDashboardView(storage,'account-a'),null);}
 assert.equal(readDashboardView({getItem(){throw Error('Storage blocked');}},'account-a'),null);
});

const gateScript=await readFile(new URL('../public/circles-entry.js',import.meta.url),'utf8');
function boot(path,{redirecting=false}={}){
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.attributes=new Map();}setAttribute(k,v){this.attributes.set(k,v);}removeAttribute(k){this.attributes.delete(k);}append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}}
 const listeners=new Map(),document={documentElement:new Element('html'),head:new Element('head'),body:new Element('body'),readyState:'loading',createElement:tag=>new Element(tag),addEventListener:(type,fn)=>listeners.set(type,fn)},window={AcademyCirclesRedirecting:redirecting};
 let reloads=0;runInNewContext(gateScript,{URL,location:{href:'https://website.test/'+path,reload(){reloads++;}},window,document});
 return {window,document,mount(){listeners.get('DOMContentLoaded')?.();},get state(){return document.documentElement.attributes.get('data-circles-home-state');},get reloads(){return reloads;}};
}
test('Home and native workspace returns are neutral before rendering and until verification completes',()=>{
 for(const path of ['?dashboard=1','?dashboard=1&workspace=learn','?workspace=teach','?workspace=admin']){
  const page=boot(path);assert.equal(page.state,'checking','Gate must precede public markup');page.mount();
  assert.equal(page.document.body.children.length,1);assert.equal(page.document.body.children[0].children[2].textContent,'Checking your account and dashboard…');
  // A slow account or navigation request does not release the gate itself.
  assert.equal(page.state,'checking');assert(page.document.body.children[0].children.every(node=>!String(node.textContent||'').includes('account-a')));
  page.window.AcademyCirclesHomeEntry.complete();assert.equal(page.state,undefined);assert.equal(page.document.body.children.length,0);
 }
});
test('public visitors, intentional Visit website and legacy Studio redirects are not converted to a private view',()=>{
 for(const [path,options] of [['',{}],['?public=1',{}],['?dashboard=1&workspace=admin&public=1',{}],['?workspace=owner',{}],['?dashboard=1',{redirecting:true}]]){
  const page=boot(path,options);page.mount();assert.equal(page.state,undefined);assert.equal(page.window.AcademyCirclesHomeEntry.pending,false);assert.equal(page.document.body.children.length,0);
 }
});
test('uncertain verification retains a neutral retry; verified signed-out completion exposes no cached private UI',()=>{
 const page=boot('?dashboard=1');page.window.AcademyCirclesHomeEntry.fail();page.mount();assert.equal(page.state,'error');
 const children=page.document.body.children[0].children;assert.equal(children[2].textContent,'Your dashboard could not be checked. Please try again.');assert.equal(children[3].hidden,false);children[3].onclick();assert.equal(page.reloads,1);
 page.window.AcademyCirclesHomeEntry.complete();assert.equal(page.state,undefined);assert.equal(page.document.body.children.length,0);
 const fast=boot('?workspace=learn');fast.window.AcademyCirclesHomeEntry.complete();fast.mount();assert.equal(fast.document.body.children.length,0,'A fast verified result must not remount a stale loader');
});
