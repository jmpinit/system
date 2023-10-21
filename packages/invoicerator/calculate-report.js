const { roundUpTwo, roundTwo } = require('./util');

/**
 * Finds the earliest and latest dates in the time log.
 * @param timeLog
 * @returns {{workStartDate: Date, workEndDate: Date}}
 */
function getStartEndDates(timeLog) {
  if (timeLog.length === 0) {
    throw new Error('Cannot calculate start and end dates for an empty time log');
  }

  const workDates = timeLog.map((entry) => entry.Date);
  const workStartDate = new Date(Math.min(...workDates));
  const workEndDate = new Date(Math.max(...workDates));

  return { workStartDate, workEndDate };
}

/**
 * Summarizes the time log by project.
 * @param timeLog
 * @param rate - hourly rate
 * @returns {*}
 */
function summarizeProject(timeLog, rate) {
  const hoursByProject = {};
  timeLog.forEach((entry) => {
    if (!(entry.Project in hoursByProject)) {
      hoursByProject[entry.Project] = {
        hours: 0,
        discountedHours: 0,
      };
    }

    const project = hoursByProject[entry.Project];
    project.hours += entry.Minutes / 60;
    project.discountedHours += entry.Discounted / 60;
  });

  const projectSummary = Object.entries(hoursByProject)
    .map(([project, { hours, discountedHours }]) => ({
      project,
      hours: roundUpTwo(hours),
      discountedHours: roundUpTwo(discountedHours),
      cost: `$${roundTwo((hours - discountedHours) * rate)}`,
    }));

  // Sort the projects in the summary by hours in descending order
  projectSummary.sort((a, b) => (parseFloat(a.hours) < parseFloat(b.hours) ? 1 : -1));

  return projectSummary;
}

/**
 * Maps each entry in the time log to the corresponding keys for the report template.
 * @param timeLog
 * @returns {*}
 */
function formatTimeLog(timeLog) {
  return timeLog.map(({ Project, Description, Minutes, Discounted }) => ({
    project: Project,
    description: Description,
    hours: roundUpTwo(Minutes / 60),
    discountedHours: Discounted > 0 ? roundUpTwo(Discounted / 60) : undefined,
  }));
}

/**
 * Calculates reported values
 * @param timeLog
 * @param rate
 * @returns {*}
 */
function calculateReportValues(timeLog, rate) {
  // Find when the work started and ended exactly
  // This can be different from the window of time specified to search for work
  const { workStartDate, workEndDate } = getStartEndDates(timeLog);

  const totalHours = timeLog
    .reduce((minutes, entry) => minutes + entry.Minutes, 0) / 60;
  const discountedHours = timeLog
    .reduce((minutes, entry) => minutes + entry.Discounted, 0) / 60;
  const paymentDue = (totalHours - discountedHours) * rate;

  return {
    workStartDate,
    workEndDate,
    totalHours,
    discountedHours,
    paymentDue,
    projectSummary: summarizeProject(timeLog, rate),
    formattedTimeLog: formatTimeLog(timeLog),
  };
}

module.exports = {
  getStartEndDates,
  calculateReportValues,
  summarizeProject,
};
