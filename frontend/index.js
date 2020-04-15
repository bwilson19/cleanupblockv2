import {
  initializeBlock,
  useBase,
  ProgressBar,
  Button,
  useRecordIds,
  useRecords,
  ConfirmationDialog,
  Box,
  Icon,
  useRecordById,
  RecordCard,
  Loader,
} from '@airtable/blocks/ui';

import React, { useState, useEffect } from 'react';

function CleanUpBlock() {
  // states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(false);
  const [publishedArchiving, setPublishedArchiving] = useState(false);
  const [publishedArchived, setPublishedArchived] = useState(false);
  const [recordsMoved, setRecordsMoved] = useState(false);
  const [processComplete, setProcessComplete] = useState(false);
  const [storedTitles, setStoredTitles] = useState([]);
  const [storedPublishedRecords, setStoredPublishedRecords] = useState([]);

  // global variables

  const base = useBase();
  const BATCH_SIZE = 50;
  const editorialTable = base.getTableByName('Editorial');
  const archiveTable = base.getTableByName('Archive');
  const publishedView = editorialTable.getViewByName('Published Pieces');
  const allRecords = useRecords(editorialTable);
  const publishedRecords = useRecords(publishedView);

  //   store records in state

  useEffect(() => {
    setStoredPublishedRecords(publishedRecords);
    findCellValues(allRecords);
  }, []);

  // find and store duplicate article records in state
  function findCellValues() {
    let titleArray = [];
    for (let i = 0; i < allRecords.length; i++) {
      let record = {
        title: allRecords[i].getCellValue(editorialTable.primaryField),
        id: allRecords[i].id,
      };
      titleArray.push(record);
    }
    setStoredTitles(titleArray);
  }

  function findDuplicates(titles) {
    let slicedTitles = titles.slice().sort();
    let sortedTitles = slicedTitles.sort((a, b) =>
      a.title > b.title ? 1 : -1
    );
    let results = [];
    for (let i = 0; i < sortedTitles.length - 1; i++) {
      if (sortedTitles[i + 1].title == sortedTitles[i].title) {
        results.push(sortedTitles[i].id);
      }
    }
    setDuplicates(results);
    console.log(results);
  }

  function RecordListItem({ table, recordId }) {
    const record = useRecordById(table, recordId);
    return <RecordCard record={record} />;
  }

  //   delete records

  async function deleteRecords(records) {
    setDuplicates(null);
    let i = 0;
    while (i < records.length) {
      const recordBatch = records.slice(i, i + BATCH_SIZE);
      await editorialTable.deleteRecordsAsync(recordBatch);
      i += BATCH_SIZE;
    }
    setProcessComplete(true);
  }

  //   create records in archive

  async function createRecords(records) {
    let i = 0;
    while (i < records.length) {
      const recordBatch = records.slice(i, i + BATCH_SIZE);
      for (let record of recordBatch) {
        await archiveTable.createRecordsAsync([
          {
            fields: {
              Title: record.getCellValue('Title'),
              Date: record.getCellValue('Date'),
            },
          },
        ]);
        i += BATCH_SIZE;
      }
    }
    setRecordsMoved(true);
  }

  // select and move published pieces to archive

  function archivePublished() {
    setIsDialogOpen(false);
    setPublishedArchiving(true);
    createRecords(storedPublishedRecords);
    if (recordsMoved === true) {
      deleteRecords(storedPublishedRecords);
    }
    if (processComplete === true) {
      setPublishedArchiving(false);
      setPublishedArchived(true);
      setProcessComplete(false)
    }
  }

  // totals base records and picks progress bar color

  let lengthArray = [];
  const baseRecords = base.tables.forEach((table) => {
    // eslint-disable-next-line
    let recordIds = useRecordIds(table);
    let tableSums = recordIds.length;
    lengthArray.push(tableSums);
  });
  const baseRecordSum = (arr) => arr.reduce((a, b) => a + b, 0);
  let total = baseRecordSum(lengthArray);
  let baseProgress = total / 100000;
  let roundedBaseProgress = baseProgress.toFixed(3);
  let baseColor;
  if (baseProgress < 0.5) {
    baseColor = '#006600';
  } else if (baseProgress < 0.8) {
    baseColor = '#ff9933';
  } else {
    baseColor = '#ff3333';
  }

  // maps each table and their progress bars

  const tables = base.tables.map((table) => {
    // eslint-disable-next-line
    let recordIds = useRecordIds(table);
    let progress = recordIds.length / 50000;
    let roundedProgress = progress.toFixed(1);
    let color;
    if (progress < 0.5) {
      color = '#006600';
    } else if (progress < 0.8) {
      color = '#ff9933';
    } else {
      color = '#ff3333';
    }

    return (
      <li style={{ paddingBottom: '1rem' }} key={table.id}>
        {table.name + ': '}
        <span style={{ fontWeight: 'bold' }}>
          {roundedProgress * 100 + '%'}
        </span>{' '}
        ({recordIds.length + ' / 50000'})
        <ProgressBar height="1rem" progress={progress} barColor={color} />
      </li>
    );
  });

  return (
    <>
      <div style={{ padding: '1rem' }}>
        <h1 align="center" style={{ textDecoration: 'underline' }}>
          Clean Up Tool (Base: {base.name})
        </h1>
        <h2>Base Records Used {baseRecords}</h2>
        <p>
          <span style={{ fontWeight: 'bold' }}>
            {roundedBaseProgress * 100 + '%'}
          </span>{' '}
          ({total + ' / 100000'})
        </p>
        <ProgressBar
          height="1rem"
          progress={baseProgress}
          barColor={baseColor}
        />
        <h2>Table Records Used</h2>
        <ul style={{ listStyleType: 'none', paddingInlineStart: '0px' }}>
          {tables}
        </ul>
        <h2>Recommendations</h2>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          border="default"
          backgroundColor="beige"
          padding={3}
          marginBottom={3}
          overflow="hidden"
        >
          <div>
            <h3>Find, Edit, & Remove Duplicates</h3>
            <p>
              This option will search through the Editorial table to make sure
              that there are no duplicate records taking up any space.
            </p>
          </div>
          {!duplicates && !duplicatesRemoved && (
            <Button onClick={() => findDuplicates(storedTitles)}>
              Find Duplicates
            </Button>
          )}
          {duplicatesRemoved && (
            <>
              <Icon name="check" size={16} />
              &nbsp;
              <p
                style={{
                  color: 'green',
                }}
              >
                Completed
              </p>
            </>
          )}
          {duplicates && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <p>
                <Icon name="warning" size={16} />
                &nbsp;
                <span
                  style={{
                    color: 'red',
                  }}
                >
                  {duplicates.length} Duplicates Found
                </span>
              </p>
              <Button
                onClick={() =>
                  deleteRecords(duplicates) && setDuplicatesRemoved(true)
                }
              >
                Remove Duplicates
              </Button>
            </div>
          )}
        </Box>
        {duplicates && (
          <ul>
            {duplicates.map((recordId) => {
              return (
                <RecordListItem
                  key={recordId}
                  recordId={recordId}
                  table={editorialTable}
                />
              );
            })}
          </ul>
        )}
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          border="default"
          backgroundColor="beige"
          padding={3}
          marginBottom={3}
          overflow="hidden"
        >
          <div>
            <h3>Archive Published Records</h3>
            <p>
              This option will move all published posts to the
              &quot;Archive&quot; table.
            </p>
          </div>
          {!publishedArchived && !publishedArchiving && (
            <Button onClick={() => setIsDialogOpen(true)}>Archive</Button>
          )}
          {publishedArchiving && !publishedArchived && <Loader scale={0.3} />}
          {publishedArchived && !publishedArchiving && (
            <>
              <Icon name="check" size={16} />
              &nbsp;
              <p
                style={{
                  color: 'green',
                }}
              >
                Completed
              </p>
            </>
          )}
          {isDialogOpen && (
            <ConfirmationDialog
              title="Are you sure?"
              body="This action can’t be undone."
              onConfirm={() => {
                archivePublished();
              }}
              onCancel={() => setIsDialogOpen(false)}
            />
          )}
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          border="default"
          backgroundColor="beige"
          padding={3}
          marginBottom={3}
          overflow="hidden"
        >
          <div>
            <h3>Archive Old Records</h3>
            <p>
              This option will move all historical records from 2015 or older to
              the &quot;Archive&quot; table.
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>Archive</Button>
          {isDialogOpen && (
            <ConfirmationDialog
              title="Are you sure?"
              body="This action can’t be undone."
              onConfirm={() => {
                archivePublished();
              }}
              onCancel={() => setIsDialogOpen(false)}
            />
          )}
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          border="default"
          backgroundColor="beige"
          padding={3}
          marginBottom={3}
          overflow="hidden"
        >
          <div>
            <h3>Delete Archive</h3>
            <p>
              Removes all records from the &quot;Archive.&quot;&nbsp;
              <span style={{ fontWeight: 'bold' }}>
                (Please note: This action cannot be undone)
              </span>
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>Archive</Button>
          {isDialogOpen && (
            <ConfirmationDialog
              title="Are you sure?"
              body="This action can’t be undone."
              onConfirm={() => {
                archivePublished();
              }}
              onCancel={() => setIsDialogOpen(false)}
            />
          )}
        </Box>
      </div>
    </>
  );
}

initializeBlock(() => <CleanUpBlock />);
