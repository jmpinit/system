const { getStartEndDates, summarizeProject } = require('../calculate-report');

describe('getStartEndDates', () => {
  it('should return the earliest and latest dates from a list of date entries', () => {
    const timeLog = [
      { Date: new Date('2023-10-18T12:00:00Z').getTime() },
      { Date: new Date('2023-10-16T12:00:00Z').getTime() },
      { Date: new Date('2023-10-20T12:00:00Z').getTime() },
    ];

    const result = getStartEndDates(timeLog);

    expect(result).toEqual({
      workStartDate: new Date('2023-10-16T12:00:00Z'),
      workEndDate: new Date('2023-10-20T12:00:00Z'),
    });
  });

  it('should return the same start and end date for a single entry', () => {
    const timeLog = [
      { Date: new Date('2023-10-18T12:00:00Z').getTime() },
    ];

    const result = getStartEndDates(timeLog);

    expect(result).toEqual({
      workStartDate: new Date('2023-10-18T12:00:00Z'),
      workEndDate: new Date('2023-10-18T12:00:00Z'),
    });
  });

  it('should throw for an empty log', () => {
    expect(() => getStartEndDates([])).toThrow();
  });
});

describe('summarizeProject', () => {
  const hourlyRate = 50; // example rate

  it('should summarize hours, discounted hours, and cost by project', () => {
    const timeLog = [
      { Project: 'A', Minutes: 120, Discounted: 0 },
      { Project: 'A', Minutes: 240, Discounted: 30 },
      { Project: 'B', Minutes: 120, Discounted: 60 },
    ];

    const result = summarizeProject(timeLog, hourlyRate);

    expect(result).toEqual([
      {
        project: 'A',
        hours: '6.00',
        discountedHours: '0.50',
        cost: '$275.00',
      },
      {
        project: 'B',
        hours: '2.00',
        discountedHours: '1.00',
        cost: '$50.00',
      },
    ]);
  });

  it('should sort projects based on the hours in descending order', () => {
    const timeLog = [
      { Project: 'A', Minutes: 120, Discounted: 0 },
      { Project: 'B', Minutes: 240, Discounted: 0 },
      { Project: 'C', Minutes: 60, Discounted: 0 },
    ];

    const result = summarizeProject(timeLog, hourlyRate);

    expect(result[0].project).toBe('B');
    expect(result[1].project).toBe('A');
    expect(result[2].project).toBe('C');
  });

  it('should handle an empty log gracefully', () => {
    const timeLog = [];
    const result = summarizeProject(timeLog, hourlyRate);
    expect(result).toEqual([]);
  });
});
