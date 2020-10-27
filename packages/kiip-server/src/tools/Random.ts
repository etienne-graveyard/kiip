import { nanoid } from 'nanoid';

// prettier-ignore
const WORDS = [
  'time', 'year', 'people', 'way', 'day', 'man', 'thing', 'woman', 'life', 'child',
  'world', 'school', 'state', 'family', 'student', 'group', 'country', 'problem',
  'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program', 'work',
  'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money',
  'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word',
  'issue', 'side', 'kind', 'head', 'house', 'friend', 'father', 'power', 'hour',
  'game', 'line', 'end', 'member', 'law', 'car', 'city', 'name', 'team', 'minute',
  'idea', 'kid', 'body', 'back', 'parent', 'face', 'others', 'level', 'office', 'door',
  'health', 'person', 'art', 'war', 'party', 'result', 'change', 'reason', 'girl',
  'guy', 'moment', 'air', 'force'
];

export const Random = {
  humanReadableToken,
  nanoid,
};

function humanReadableToken(size: number = 4) {
  return nanoid(size)
    .split('')
    .map((v) => WORDS[v.charCodeAt(0) - 45])
    .join('-');
}
