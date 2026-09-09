// دمج البيانات مباشرة أثناء البناء لتجنب مشاكل الاتصال
import results from '../../history.json';

export async function onRequest(context) {
  try {
    // نأخذ آخر 180 قراءة فقط
    const latestResults = results.slice(0, 180);
    latestResults.reverse(); 

    const rows_24h = latestResults.map(r => ({
      t: r.ts * 1000, 
      power: r.power !== null ? Math.round(r.power * 10) / 10 : 0.0,
      current: r.current !== null ? Math.round(r.current * 1000) / 1000 : 0.0,
      voltage: r.voltage !== null ? Math.round(r.voltage * 10) / 10 : 220.0
    }));

    return new Response(JSON.stringify({
      power_24h: rows_24h,
      power_30d: [],
      cost_sar: 0,
      total_kwh_month: 0
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
