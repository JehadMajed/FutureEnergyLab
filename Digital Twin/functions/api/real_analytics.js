// دمج البيانات مباشرة أثناء البناء
import results from '../../real_analytics.json';

export async function onRequest(context) {
  try {
    const daily = results.map(r => ({
      day: r.day_str,
      total_readings: r.total_readings,
      running_readings: r.running_readings,
      zero_readings: r.zero_readings,
      run_hours: Math.round((r.run_seconds / 3600.0) * 100) / 100,
      zero_hours: Math.round((r.zero_seconds / 3600.0) * 100) / 100,
      avg_power: Math.round(r.avg_running_power * 10) / 10,
      avg_voltage: Math.round(r.avg_voltage * 10) / 10,
      avg_pf: Math.round(r.avg_power_factor * 100) / 100,
      energy_kwh: Math.round(r.energy_kwh * 100) / 100
    }));

    let tot_run_hours = 0;
    let tot_zero_hours = 0;
    let tot_energy = 0;
    let sum_avg_pf = 0;

    daily.forEach(r => {
      tot_run_hours += r.run_hours;
      tot_zero_hours += r.zero_hours;
      tot_energy += r.energy_kwh;
      sum_avg_pf += r.avg_pf;
    });

    const tot_hours = tot_run_hours + tot_zero_hours;
    const uptime_pct = tot_hours > 0 ? Math.round((tot_run_hours / tot_hours) * 1000) / 10 : 0.0;
    const avg_pf_overall = daily.length > 0 ? Math.round((sum_avg_pf / daily.length) * 100) / 100 : 0.70;

    return new Response(JSON.stringify({
      ok: true,
      daily,
      summary: {
        total_days: daily.length,
        total_run_hours: Math.round(tot_run_hours * 10) / 10,
        total_zero_hours: Math.round(tot_zero_hours * 10) / 10,
        uptime_percentage: uptime_pct,
        total_energy_kwh: Math.round(tot_energy * 10) / 10,
        avg_power_factor: avg_pf_overall
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message, daily: [], summary: {} }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
