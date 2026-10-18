import type { DeliveryTimeReport } from '../../../domain';
import { VEHICLE_LABELS, formatMinutes } from '../../labels/report-labels';
import styles from './delivery-time-table.module.css';

/** Tempo de entrega geral e por tipo de veículo (média, mais rápida, mais lenta). */
export function DeliveryTimeTable({ report }: { readonly report: DeliveryTimeReport }) {
  const overall = {
    average: report.averageMinutes,
    fastest: report.fastestMinutes,
    slowest: report.slowestMinutes,
  };
  const show = (value: number | null): string => (value === null ? '—' : formatMinutes(value));

  return (
    <table className={styles.table}>
      <caption className="visually-hidden">Tempo de entrega por tipo de veículo</caption>
      <thead>
        <tr>
          <th scope="col">Veículo</th>
          <th scope="col">Entregas</th>
          <th scope="col">Média</th>
          <th scope="col">Mais rápida</th>
          <th scope="col">Mais lenta</th>
        </tr>
      </thead>
      <tbody>
        {report.byVehicleType.map((group) => (
          <tr key={group.vehicleType}>
            <th scope="row">{VEHICLE_LABELS[group.vehicleType]}</th>
            <td>{group.count}</td>
            <td>{formatMinutes(group.averageMinutes)}</td>
            <td>{formatMinutes(group.fastestMinutes)}</td>
            <td>{formatMinutes(group.slowestMinutes)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Todos</th>
          <td>{report.totalDelivered}</td>
          <td>{show(overall.average)}</td>
          <td>{show(overall.fastest)}</td>
          <td>{show(overall.slowest)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
