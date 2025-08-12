import video from '@/video/locales/en'
import home from '@/home/locales/en'
import auth from '@/login/locales/en'
import admin from '@/home/locales/en'

const pointcloud = {}

export default {
  'app.title': 'Yinghuo Data Annotation',
  'app.description': 'A 2D GUI for the web.',
  'app.welcome': 'Welcome',
  jobManage: {
    title: 'Job Management',
    toolbar: {
      create: 'New Job'
    }
  },
  components: {
    annoSpecSelector: {
      tooltip: 'Select Annotation Specification',
      systemSpec: 'System Spec',
      mySpec: 'My Spec',
      newSpec: 'New Spec',
      select: 'Select',
      name: 'Name',
      code: 'Code',
      category: 'Category',
      version: 'Version',
      language: 'Language',
      reference: 'Reference',
      description: 'Description',
      updatedTime: 'Updated Time',
      enabled: 'Enabled',
      desc: 'Description'
    },
    prioritySelect: {
      placeholder: 'Select Priority',
      lowest: '1-Lowest',
      medium: '3-Medium',
      highest: '5-Highest'
    },
    rolesSelect: {
      placeholder: 'Select Roles'
    },
    tableCustom: {
      deleteSelection: 'Delete Selection',
      refresh: 'Refresh',
      columnSettings: 'Column Settings',
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      deleteConfirm: 'Are you sure to delete?',
      deleteTitle: 'Warning'
    },
    tableEdit: {
      save: 'Save',
      required: '{label} is required'
    },
    tableSearch: {
      rangeSeparator: 'To',
      startDate: 'Start Date',
      endDate: 'End Date',
      search: 'Search',
      reset: 'Reset'
    },
    tabs: {
      options: 'Tab Options',
      refresh: 'Refresh',
      closeOther: 'Close Others',
      closeCurrent: 'Close Current',
      closeAll: 'Close All'
    },
    teamMembersSelect: {
      placeholder: 'Please select',
      noMembers: 'Please add team members first'
    }
  },
  states: {
    dataSeqState: {
      alert: {
        title: 'Info',
        message: 'The task data is on your computer, please select the folder: {stream}. This operation will not upload data files.',
        confirmButtonText: 'Select Data Folder'
      },
      messages: {
        fileNotFound: 'File not found: {fileExts}, please select again',
        exception: 'Exception: {err}'
      }
    }
  },
  video,
  home,
  pointcloud,
  auth,
  admin
}
