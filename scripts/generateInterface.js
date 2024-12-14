const fs = require('fs').promises
const path = require('path')
const ora = require('ora')

module.exports = class DocTypeInterfaceGenerator {
  constructor(appsPath, appDoctypeMap, outputPath) {
    this.appsPath = appsPath
    this.appDoctypeMap = appDoctypeMap
    this.outputPath = outputPath
    this.processedDoctypes = new Set()
    this.existingInterfaces = {}
    this.updatedInterfaces = 0
    this.spinner = ora('Generating doctype interfaces...').start()
    this.jsonFileCache = new Map()
  }

  async generate() {
    await this.loadExistingInterfaces()

    const promises = []
    for (const appName of Object.keys(this.appDoctypeMap)) {
      for (const doctypeName of this.appDoctypeMap[appName]) {
        promises.push(this.processDoctype(appName, doctypeName))
      }
    }
    await Promise.all(promises)

    if (this.updatedInterfaces > 0) {
      const baseInterfaces = this.generateBaseInterfaces()
      const interfacesString = [
        baseInterfaces,
        ...Object.values(this.existingInterfaces),
      ].join('\n')

      await fs.mkdir(path.dirname(this.outputPath), { recursive: true })
      await fs.writeFile(this.outputPath, interfacesString)
      this.spinner.succeed(
        `Updated ${this.updatedInterfaces} interface${this.updatedInterfaces === 1 ? '' : 's'}. Output file updated.`,
      )
    } else {
      this.spinner.info('No new schema changes.')
    }
  }

  async loadExistingInterfaces() {
    try {
      const outputContent = await fs.readFile(this.outputPath, 'utf8')
      const interfaceMatches = outputContent.match(
        /\/\/ Last updated: [^\n]+\nexport interface\s+\w+\s+extends\s+\w+\s+{[^}]+}\n/g,
      )
      if (interfaceMatches) {
        interfaceMatches.forEach((interfaceStr) => {
          const match = interfaceStr.match(/export interface\s+(\w+)\s+extends/)
          if (match) {
            const interfaceName = match[1]
            this.existingInterfaces[interfaceName] = interfaceStr
          }
        })
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }
  }

  async processDoctype(appName, doctypeName) {
    if (this.processedDoctypes.has(doctypeName)) {
      return
    }
    this.processedDoctypes.add(doctypeName)

    const jsonFilePath = await this.findJsonFile(appName, doctypeName)
    if (!jsonFilePath) {
      this.spinner.text = `Processing: ${doctypeName} [not found]`
      return
    }
    const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'))
    const lastModified = jsonData.modified

    const interfaceName = jsonData.name.replace(/\s+/g, '')
    const existingInterface = this.existingInterfaces[interfaceName]
    if (
      existingInterface &&
      existingInterface.includes(`// Last updated: ${lastModified}`)
    ) {
      this.spinner.text = `Processing: ${doctypeName} [skipped]`
      return
    }

    const fields = jsonData.fields

    const typeMapping = {
      Data: 'string',
      'Text Editor': 'string',
      Link: 'string',
      Table: 'any[]',
      'Table MultiSelect': 'any[]',
      Percent: 'number',
      Int: 'number',
      Float: 'number',
      Datetime: 'string', // "YYYY-MM-DD HH:MM:SS"
      Date: 'string', // "YYYY-MM-DD"
      Check: '0 | 1',
      'Attach Image': 'string',
      'Dynamic Link': 'string',
      'Small Text': 'string',
      Color: 'string',
      Text: 'string',
      Autocomplete: 'string',
      Password: 'string',
      Code: 'string',
      'Read Only': 'string',
    }

    let interfaceString = `// Last updated: ${lastModified}\nexport interface ${interfaceName} extends ${jsonData.istable ? 'ChildDocType' : 'DocType'} {\n`

    for (const field of fields) {
      if (
        [
          'Section Break',
          'Column Break',
          'Tab Break',
          'HTML',
          'Button',
        ].includes(field.fieldtype)
      ) {
        continue
      }
      let tsType = typeMapping[field.fieldtype] || 'any'
      if (field.fieldtype === 'Select' && field.options) {
        const options = field.options
          .split('\n')
          .map((option) => `'${option}'`)
          .join(' | ')
        tsType = options
      } else if (
        ['Table', 'Table MultiSelect'].includes(field.fieldtype) &&
        field.options
      ) {
        const relatedDoctype = field.options
        tsType = `${relatedDoctype.replace(/\s+/g, '')}[]`
        await this.processDoctype(
          appName,
          relatedDoctype.toLowerCase().replace(/ /g, '_'),
        )
      }
      let description = `/** ${field.label}: ${field.fieldtype}`
      if (
        ['Table', 'Table MultiSelect', 'Link', 'Dynamic Link'].includes(
          field.fieldtype,
        ) &&
        field.options
      ) {
        description += ` (${field.options})`
      }
      description += ' */'
      interfaceString += `  ${description}\n  ${field.fieldname}${
        field.reqd || field.fieldtype === 'Check' ? '' : '?'
      }: ${tsType};\n`
    }

    interfaceString += `}\n`
    this.updatedInterfaces++
    this.existingInterfaces[interfaceName] = interfaceString
    this.spinner.text = `Processing: ${doctypeName} [updated]`
  }

  async findJsonFile(appName, doctypeName) {
    const cacheKey = `${appName}/${doctypeName}`
    if (this.jsonFileCache.has(cacheKey)) {
      return this.jsonFileCache.get(cacheKey)
    }

    const targetPattern = path.join(
      'doctype',
      doctypeName,
      `${doctypeName}.json`,
    )
    let foundPath = null

    const searchDirectory = async (directory) => {
      const files = await fs.readdir(directory)
      for (const file of files) {
        const fullPath = path.join(directory, file)
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await searchDirectory(fullPath)
        } else if (fullPath.endsWith(targetPattern)) {
          foundPath = fullPath
          return
        }
      }
    }

    await searchDirectory(path.join(this.appsPath, appName))

    this.jsonFileCache.set(cacheKey, foundPath)
    return foundPath
  }

  generateBaseInterfaces() {
    return `interface DocType {
  name: string;
  creation: string;
  modified: string;
  owner: string;
  modified_by: string;
}

interface ChildDocType extends DocType {
  parent?: string;
  parentfield?: string;
  parenttype?: string;
  idx?: number;
}
`
  }
}
