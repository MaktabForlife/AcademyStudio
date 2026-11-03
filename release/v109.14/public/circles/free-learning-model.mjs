export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function sourceVideo(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : ['www.youtube.com','youtube.com'].includes(url.hostname) && url.pathname === '/watch' ? url.searchParams.get('v') : null;
    if (!/^[\w-]{11}$/.test(id || '')) return null;
    const stamp = url.searchParams.get('t') || url.searchParams.get('start') || '0';
    return {id, start: /^\d+s?$/.test(stamp) ? Number(stamp.replace(/s$/, '')) : 0};
  } catch { return null; }
}
export function topicItems(items = []) {
  return items.flatMap(item => {
    const match = String(item).match(/^((?:\d+:)?\d{1,2}:\d{2})\s+(.+)$/);
    if (!match) return [];
    const start = match[1].split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
    return [{time: match[1], title: match[2], start}];
  });
}
export function courseRecordings(course, supplied = []) {
  const entries = new Map();
  for (const lesson of course.lessons.filter(isRecordingLesson)) {
    const videos = lesson.sections.flatMap(section => section.blocks).filter(block => block.type === 'video');
    for (const block of videos) {
      const video = sourceVideo(block.videoUrl);
      if (!video) continue;
      if (!entries.has(video.id)) entries.set(video.id, {id: video.id, title: lesson.title, summary: lesson.summary || '', lessonId: lesson.id, duration: block.durationSeconds || 0, topics: [], readings: []});
      const entry = entries.get(video.id);
      const quote=lesson.sections.flatMap(section=>section.blocks).find(item=>item.type==='quote'&&sourceVideo(item.videoUrl)?.id===video.id);
      if(quote){const stamp=sourceVideo(quote.videoUrl).start;entry.quote={text:quote.text,start:stamp,time:formatTimestamp(stamp)};}
      entry.topics = [...new Map([...entry.topics, ...topicItems(block.items)].map(topic => [topic.start, topic])).values()].sort((a,b) => a.start-b.start);
    }
  }
  for (const lesson of course.lessons.filter(item => !isRecordingLesson(item))) {
    const ids = new Set(lesson.sections.flatMap(section => section.blocks).filter(block => block.type === 'video').map(block => sourceVideo(block.videoUrl)?.id));
    for (const id of ids) if (entries.has(id)) entries.get(id).readings.push(lesson.id);
  }
  for (const item of supplied) {
    if (!/^[\w-]{11}$/.test(item.id || '')) continue;
    const entry=entries.get(item.id)||{id:item.id,title:item.title||item.date||'',summary:'',duration:0,topics:[],readings:[]};
    const suppliedTopics=[...topicItems(item.topicItems||[]),...topicItems((item.topics||[]).map(topic=>topic.time+' '+topic.title))];
    entry.summary=item.summary||entry.summary;
    entry.duration=item.duration||entry.duration;
    entry.date=item.date||entry.date||'';
    entry.studioRecordingId=item.studioRecordingId||entry.studioRecordingId;
    entry.academyRecordingId=item.academyRecordingId||entry.academyRecordingId;
    entry.sourceLessonId=item.sourceLessonId||entry.sourceLessonId;
    entry.summaryHeading=item.summaryHeading||entry.summaryHeading||entry.title;
    if(item.quote?.text){const stamp=topicItems([(item.quote.timestamp||'')+' Quote'])[0];entry.quote={text:item.quote.text,time:stamp?.time||'',start:stamp?.start??null};}
    entry.lessonId=entry.lessonId||item.lessonId;
    entry.topics=[...new Map([...entry.topics,...suppliedTopics].map(topic=>[topic.start,topic])).values()].sort((a,b)=>a.start-b.start);
    entry.readings=[...new Set([...entry.readings,...(item.readingIds||[])])].filter(id=>course.lessons.some(lesson=>lesson.id===id));
    entries.set(item.id,entry);
  }
  return [...entries.values()];
}
export const isRecordingLesson = lesson => ['The recorded lessons','Recorded lesson companions'].includes(lesson.group);
export function recordingWebReadings(course,entry){
 const readings=course.lessons.filter(lesson=>!isRecordingLesson(lesson));
 const linked=readings.filter(lesson=>entry.readings?.includes(lesson.id));
 return {lessons:linked.length?linked:readings,linked:Boolean(linked.length)};
}
const formatTimestamp=seconds=>{const value=Math.floor(seconds);return (value>=3600?Math.floor(value/3600)+':':'')+String(Math.floor(value%3600/60)).padStart(value>=3600?2:1,'0')+':'+String(value%60).padStart(2,'0');};
