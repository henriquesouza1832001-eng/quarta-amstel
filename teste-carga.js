import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
stages: [
  { duration: '15s', target: 100 },
  { duration: '20s', target: 250 },
  { duration: '20s', target: 500 },
  { duration: '15s', target: 0 },
],

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const res = http.get(
    'https://quartaamstel-worker.henriquesouza.workers.dev/bares?lat=-19.9167&lng=-43.9345'
  );

  check(res, {
    'status 200': (r) => r.status === 200,
    'resposta abaixo de 1s': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}