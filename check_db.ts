import { PeopleHRService } from './dashboard-v2/src/services/people-hr.service';

async function check() {
  const isTestMode = true;
  console.log("Fetching employees with isTestMode = true...");
  try {
    const emps = await PeopleHRService.getEmployeesForPeople({ mostrarInativos: true, isTestMode });
    const carlos = emps.filter(e => e.name.toLowerCase().includes('carlos'));
    const fabio = emps.filter(e => e.name.toLowerCase().includes('fontenelle') || e.name.toLowerCase().includes('fábio'));
    
    console.log("Test Mode Carlos:");
    console.log(JSON.stringify(carlos.map(c => ({ id: c.id, name: c.name, status: c.status, status_end_date: c.status_end_date, department: c.department })), null, 2));
    
    console.log("Test Mode Fabio:");
    console.log(JSON.stringify(fabio.map(f => ({ id: f.id, name: f.name, status: f.status, status_end_date: f.status_end_date, department: f.department })), null, 2));
    
  } catch(e) {
    console.error(e);
  }
}

check();
