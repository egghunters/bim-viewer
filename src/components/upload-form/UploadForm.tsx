import { Component, Prop, Vue, Emit } from "vue-property-decorator";
import { Form, Upload } from "element-ui";
import { VNode } from "vue/types/umd";
import styles from "./UploadForm.module.scss";

export interface UploadFormProps {
  projectId: string
}

@Component
export default class UploadForm extends Vue {
  @Prop({ default: "" }) projectId!: UploadFormProps["projectId"]

  @Emit()
  submit(data: {}) {}

  uploadFiles: File[] = []
  uploadFormData = {
    projectName: "",
    projectDescription: ""
  }

  get uploadTip() {
    return "Upload model file";
  }

  mounted() {
  }

  reset() {
    const upload = this.$refs.upload as Upload;
    const form = this.$refs.form as Form;
    form.resetFields();
    upload && upload.clearFiles();
    this.uploadFiles = [];
  }

  async submitUpload() {
    const upload = this.$refs.upload as Upload;
    upload && upload.submit();
    this.submit({ ...this.uploadFormData, uploadFiles: this.uploadFiles });
    this.reset();
  }

  httpRequest(param: { file: any }) {
    this.uploadFiles.push(param.file);
  }

  protected render(): VNode {
    return (
      <el-form
        class={styles.uploadForm}
        ref="form"
        label-width="120px"
        size="mini"
        {
          ...{
            props: {
              model: this.uploadFormData
            }
          }
        }>
        {!this.projectId && <div>
          <el-form-item label="项目名称" prop="projectName">
            <el-input v-model={this.uploadFormData.projectName}></el-input>
          </el-form-item><el-form-item label="项目描述" prop="projectDescription">
            <el-input v-model={this.uploadFormData.projectDescription}></el-input>
          </el-form-item>
          <el-button size="mini" type="success" onClick={this.submitUpload} class="upload-success">创建新项目</el-button>
        </div>}
        {this.projectId && <div>
          <el-upload
            ref="upload"
            action=""
            multiple
            class={styles.fileUpload}
            http-request={this.httpRequest}
            file-list={this.uploadFiles}
            auto-upload={false}>
            <el-button slot="trigger" size="mini" type="primary">Pick a file</el-button>
            <el-button size="mini" type="success" onClick={this.submitUpload} class="upload-success">Upload to server</el-button>
            <div slot="tip">{this.uploadTip}</div>
          </el-upload>
        </div>}
      </el-form>
    );
  }
}
