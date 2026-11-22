import { FilePond, registerPlugin } from 'react-filepond'
import 'filepond/dist/filepond.min.css'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import styles from './FileUpload.module.css'

registerPlugin(FilePondPluginImagePreview)

// Cover image picker (drag and drop or browse), themed to match the app
const FileUploader = ({ files, onUpdateFiles, label = 'Cover image' }) => (
    <div className={styles.wrap}>
        <span className={styles.label} id="cover-label">{label}</span>
        <FilePond
            files={files ? [{ source: files }] : []}
            onupdatefiles={onUpdateFiles}
            allowMultiple={false}
            maxFiles={1}
            acceptedFileTypes={['image/*']}
            name="cover"
            credits={false}
            imagePreviewMaxHeight={240}
            labelIdle='Drag a cover image here or <span class="filepond--label-action">browse</span>'
        />
    </div>
)

export default FileUploader
