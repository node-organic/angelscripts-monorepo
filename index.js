const execa = require('execa')
const loadDna = require('organic-dna-loader')
const path = require('path')
const colors = require('colors/safe')

module.exports = function (angel) {
  const CELLS_ROOT = angel.cells_root || process.cwd()
  const executeCommand = async function ({ cellName, cmd, cwd, env }) {
    return new Promise((resolve, reject) => {
      console.log(colors.blue(cellName), cmd, cwd)
      let child = execa.shell(cmd, {
        cwd: cwd,
        env: env
      })
      child.stdout.on('data', chunk => {
        console.log(colors.blue(cellName), chunk.toString())
      })
      child.stderr.on('data', chunk => {
        console.error(colors.blue(cellName), colors.red(chunk.toString()))
      })
      child.on('exit', status => {
        if (status !== 0) return reject(new Error(cmd + ' returned ' + status))
        resolve()
      })
    })
  }
  const executeCommandOnCells = async function ({cmd, cellName, groupName}, done) {
    loadDna(path.join(CELLS_ROOT, 'dna'), (err, dna) => {
      if (err) throw err
      let tasks = []
      for (let name in dna.cells) {
        if (cellName && name !== cellName) continue
        if (groupName && dna.cells[name].group !== groupName) continue
        tasks.push({
          name: name,
          cellDna: dna.cells[name]
        })
      }
      let tasksCounter = tasks.length
      tasks.forEach(info => {
        executeCommand({
          cellName: info.name,
          cmd: cmd,
          cwd: path.join(CELLS_ROOT, 'cells', info.name),
          env: process.env
        }).catch(err => {
          console.error(colors.red(err))
        }).then(() => {
          tasksCounter -= 1
          if (tasksCounter === 0) done()
        })
      })
    })
  }
  angel.on(/repo cell (.*) -- (.*)/, function (angel, done) {
    executeCommandOnCells({
      cmd: angel.cmdData[1],
      cellName: angel.cmdData[2]
    }, done)
  })
    .description('repo cell :cellName -- :cmd')
    .example('repo cell api -- npm install')
  angel.on(/repo cells -- (.*)/, function (angel, done) {
    executeCommandOnCells({
      cmd: angel.cmdData[1]
    }, done)
  })
    .description('repo cells -- :cmd')
    .example('repo cells -- npm install')
  angel.on(/repo cellgroup (.*) -- (.*)/, function (angel, done) {
    executeCommandOnCells({
      cmd: angel.cmdData[1],
      groupName: angel.cmdData[2]
    }, done)
  })
    .description('repo cellgroup :groupName -- :cmd')
    .example('repo cellgroup frontend -- npm install')
}
